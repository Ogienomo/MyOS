import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Helper: get today's date string
function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

// Helper: get date N days ago
function getDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

// Helper: get the Monday of the current week
function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

// Helper: calculate streak info for a habit
function calculateStreaks(
  logs: Array<{ date: string; completed: boolean }>,
  frequency: string,
  customDays?: string | null,
  targetPerWeek?: number | null
): { currentStreak: number; longestStreak: number } {
  if (logs.length === 0) return { currentStreak: 0, longestStreak: 0 }

  const completedDates = logs
    .filter((l) => l.completed)
    .map((l) => l.date)
    .sort()

  if (completedDates.length === 0) return { currentStreak: 0, longestStreak: 0 }

  // For daily/custom habits: count consecutive days
  if (frequency === 'daily' || frequency === 'custom') {
    // For custom, check which days are expected
    const expectedDays = customDays ? JSON.parse(customDays) as number[] : [1, 2, 3, 4, 5, 6, 7]

    // Build a set of completed dates
    const completedSet = new Set(completedDates)

    // Current streak: go back from today
    let currentStreak = 0
    const today = new Date()
    let checkDate = new Date(today)

    // If today is not an expected day, skip to the last expected day
    // But if today IS expected and completed, count it
    for (let i = 0; i < 365; i++) {
      checkDate.setDate(today.getDate() - i)
      const dayOfWeek = checkDate.getDay() === 0 ? 7 : checkDate.getDay() // 1=Mon, 7=Sun
      const dateStr = checkDate.toISOString().split('T')[0]

      if (expectedDays.includes(dayOfWeek)) {
        if (completedSet.has(dateStr)) {
          currentStreak++
        } else {
          // Allow today to be uncompleted (not break streak)
          if (i === 0) continue
          break
        }
      }
    }

    // Longest streak
    let longestStreak = 0
    let tempStreak = 0
    const allDates: string[] = []
    const start = new Date(getDaysAgo(365))
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay()
      if (expectedDays.includes(dayOfWeek)) {
        allDates.push(d.toISOString().split('T')[0])
      }
    }

    for (const dateStr of allDates) {
      if (completedSet.has(dateStr)) {
        tempStreak++
        longestStreak = Math.max(longestStreak, tempStreak)
      } else {
        tempStreak = 0
      }
    }

    return { currentStreak, longestStreak }
  }

  // For weekly habits: count consecutive weeks where target was met
  if (frequency === 'weekly' && targetPerWeek) {
    // Group completions by week
    const weekMap = new Map<string, number>()
    for (const dateStr of completedDates) {
      const d = new Date(dateStr)
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const weekStart = new Date(d)
      weekStart.setDate(diff)
      const weekKey = weekStart.toISOString().split('T')[0]
      weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + 1)
    }

    // Current streak: go back from current week
    let currentStreak = 0
    const todayWeekStart = new Date()
    const todayDay = todayWeekStart.getDay()
    const todayDiff = todayWeekStart.getDate() - todayDay + (todayDay === 0 ? -6 : 1)
    todayWeekStart.setDate(todayDiff)
    const todayWeekKey = todayWeekStart.toISOString().split('T')[0]

    for (let i = 0; i < 52; i++) {
      const checkWeek = new Date(todayWeekStart)
      checkWeek.setDate(todayWeekStart.getDate() - i * 7)
      const weekKey = checkWeek.toISOString().split('T')[0]
      const count = weekMap.get(weekKey) || 0
      if (count >= (targetPerWeek || 1)) {
        currentStreak++
      } else {
        if (i === 0) continue // Current week might not be done yet
        break
      }
    }

    // Longest streak
    let longestStreak = 0
    let tempStreak = 0
    const sortedWeeks = [...weekMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    for (const [, count] of sortedWeeks) {
      if (count >= (targetPerWeek || 1)) {
        tempStreak++
        longestStreak = Math.max(longestStreak, tempStreak)
      } else {
        tempStreak = 0
      }
    }

    return { currentStreak, longestStreak }
  }

  return { currentStreak: 0, longestStreak: 0 }
}

// Helper: check if a habit is scheduled for today
function isScheduledToday(frequency: string, customDays?: string | null): boolean {
  const today = new Date().getDay()
  const dayOfWeek = today === 0 ? 7 : today // 1=Mon, 7=Sun

  if (frequency === 'daily') return true
  if (frequency === 'custom' && customDays) {
    const days = JSON.parse(customDays) as number[]
    return days.includes(dayOfWeek)
  }
  if (frequency === 'weekly') return true // Weekly habits show every day
  return true
}

// GET /api/habits — List habits with stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'

    const where = activeOnly ? { active: true } : {}

    const habits = await db.habit.findMany({
      where,
      include: { logs: true },
      orderBy: { createdAt: 'desc' },
    })

    const today = getToday()
    const weekStart = getWeekStart()

    const enriched = habits.map((habit) => {
      const { currentStreak, longestStreak } = calculateStreaks(
        habit.logs,
        habit.frequency,
        habit.customDays,
        habit.targetPerWeek
      )

      const completedToday = habit.logs.some((l) => l.date === today && l.completed)

      // Weekly progress
      const weekLogs = habit.logs.filter(
        (l) => l.date >= weekStart && l.completed
      )
      const weeklyProgress = weekLogs.length
      const weeklyTarget = habit.frequency === 'weekly'
        ? (habit.targetPerWeek || 1)
        : habit.frequency === 'daily'
          ? 7
          : habit.customDays
            ? (JSON.parse(habit.customDays) as number[]).length
            : 7

      // Last 30 days heatmap
      const last30Days = []
      for (let i = 29; i >= 0; i--) {
        const dateStr = getDaysAgo(i)
        const log = habit.logs.find((l) => l.date === dateStr)
        last30Days.push({
          date: dateStr,
          completed: log ? log.completed : false,
        })
      }

      const scheduledToday = isScheduledToday(habit.frequency, habit.customDays)

      return {
        id: habit.id,
        title: habit.title,
        description: habit.description,
        area: habit.area,
        frequency: habit.frequency,
        customDays: habit.customDays,
        targetPerWeek: habit.targetPerWeek,
        color: habit.color,
        active: habit.active,
        createdAt: habit.createdAt,
        updatedAt: habit.updatedAt,
        currentStreak,
        longestStreak,
        completedToday,
        scheduledToday,
        weeklyProgress,
        weeklyTarget,
        last30Days,
      }
    })

    return NextResponse.json(enriched)
  } catch (error) {
    console.error('Failed to fetch habits:', error)
    return NextResponse.json(
      { error: 'Failed to fetch habits' },
      { status: 500 }
    )
  }
}

// POST /api/habits — Create habit
export async function POST(request: NextRequest) {
  try {
    const { title, description, area, frequency, customDays, targetPerWeek, color } = await request.json() as { title: string; description?: string; area: string; frequency: string; customDays?: number[]; targetPerWeek?: number; color?: string }

    if (!title || !area || !frequency) {
      return NextResponse.json(
        { error: 'Title, area, and frequency are required' },
        { status: 400 }
      )
    }

    const validFrequencies = ['daily', 'weekly', 'custom']
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json(
        { error: 'Frequency must be daily, weekly, or custom' },
        { status: 400 }
      )
    }

    const habit = await db.habit.create({
      data: {
        title,
        description: description || null,
        area,
        frequency,
        customDays: customDays ? JSON.stringify(customDays) : null,
        targetPerWeek: targetPerWeek || null,
        color: color || null,
        active: true,
      },
    })

    return NextResponse.json(habit, { status: 201 })
  } catch (error) {
    console.error('Failed to create habit:', error)
    return NextResponse.json(
      { error: 'Failed to create habit' },
      { status: 500 }
    )
  }
}

// PUT /api/habits — Update habit
export async function PUT(request: NextRequest) {
  try {
    const { id, title, description, area, frequency, customDays, targetPerWeek, color, active } = await request.json() as { id: string; title?: string; description?: string; area?: string; frequency?: string; customDays?: number[]; targetPerWeek?: number; color?: string; active?: boolean }

    if (!id) {
      return NextResponse.json(
        { error: 'Habit ID is required' },
        { status: 400 }
      )
    }

    const existing = await db.habit.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Habit not found' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description || null
    if (area !== undefined) updateData.area = area
    if (frequency !== undefined) updateData.frequency = frequency
    if (customDays !== undefined) updateData.customDays = customDays ? JSON.stringify(customDays) : null
    if (targetPerWeek !== undefined) updateData.targetPerWeek = targetPerWeek || null
    if (color !== undefined) updateData.color = color || null
    if (active !== undefined) updateData.active = active

    const updated = await db.habit.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update habit:', error)
    return NextResponse.json(
      { error: 'Failed to update habit' },
      { status: 500 }
    )
  }
}

// DELETE /api/habits — Delete habit
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Habit ID is required' },
        { status: 400 }
      )
    }

    const existing = await db.habit.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Habit not found' },
        { status: 404 }
      )
    }

    await db.habit.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete habit:', error)
    return NextResponse.json(
      { error: 'Failed to delete habit' },
      { status: 500 }
    )
  }
}

// PATCH /api/habits — Toggle completion for a date
export async function PATCH(request: NextRequest) {
  try {
    const { habitId, date, completed } = await request.json() as { habitId: string; date?: string; completed?: boolean }

    if (!habitId) {
      return NextResponse.json(
        { error: 'Habit ID is required' },
        { status: 400 }
      )
    }

    const habit = await db.habit.findUnique({
      where: { id: habitId },
      include: { logs: true },
    })

    if (!habit) {
      return NextResponse.json(
        { error: 'Habit not found' },
        { status: 404 }
      )
    }

    const logDate = date || getToday()
    const existingLog = habit.logs.find((l) => l.date === logDate)

    let newCompleted: boolean
    if (completed !== undefined) {
      newCompleted = completed
    } else {
      // Toggle
      newCompleted = existingLog ? !existingLog.completed : true
    }

    let log
    if (existingLog) {
      log = await db.habitLog.update({
        where: { id: existingLog.id },
        data: { completed: newCompleted },
      })
    } else {
      log = await db.habitLog.create({
        data: {
          habitId,
          date: logDate,
          completed: newCompleted,
        },
      })
    }

    // Recalculate streaks
    const updatedLogs = await db.habitLog.findMany({
      where: { habitId },
    })
    const { currentStreak, longestStreak } = calculateStreaks(
      updatedLogs,
      habit.frequency,
      habit.customDays,
      habit.targetPerWeek
    )

    const completedToday = logDate === getToday()
      ? newCompleted
      : updatedLogs.some((l) => l.date === getToday() && l.completed)

    return NextResponse.json({
      log,
      currentStreak,
      longestStreak,
      completedToday,
    })
  } catch (error) {
    console.error('Failed to toggle habit completion:', error)
    return NextResponse.json(
      { error: 'Failed to toggle habit completion' },
      { status: 500 }
    )
  }
}
