import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTodayInTimezone, formatDateInTimezone } from '@/lib/utils'

// GET /api/dashboard - Aggregated dashboard data
export async function GET() {
  try {
    const today = getTodayInTimezone()

    // Get start of current week (Sunday)
    const now = new Date()
    const dayOfWeek = now.getDay()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - dayOfWeek)
    const weekStartStr = formatDateInTimezone(weekStart)

    // 1. Today's scores
    const todayScores = await db.lifeAreaScore.findUnique({
      where: { date: today },
    })

    // 2. Recent check-ins (last 5)
    const recentCheckIns = await db.checkIn.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    // Parse check-in data
    const parsedCheckIns = recentCheckIns.map((ci) => ({
      ...ci,
      data: JSON.parse(ci.data),
      aiResponse: ci.aiResponse ? JSON.parse(ci.aiResponse) : null,
    }))

    // 3. Next check-in based on time of day
    const currentHour = new Date().getHours()
    let nextCheckIn: { type: string; label: string; time: string }
    if (currentHour < 5) {
      nextCheckIn = { type: 'morning', label: 'Morning Alignment', time: '5:00 AM' }
    } else if (currentHour < 12) {
      nextCheckIn = { type: 'midday', label: 'Midday Correction', time: '12:00 PM' }
    } else if (currentHour < 20) {
      nextCheckIn = { type: 'evening', label: 'Evening Review', time: '8:30 PM' }
    } else {
      // After 8:30 PM, next is tomorrow morning
      nextCheckIn = { type: 'morning', label: 'Morning Alignment (Tomorrow)', time: '5:00 AM' }
    }

    // Check if today's check-in for the current/next type already exists
    const todayCheckIns = await db.checkIn.findMany({
      where: { date: today },
    })
    const completedCheckInTypes = todayCheckIns.map((ci) => ci.type)

    // 4. Active drift alerts
    const activeAlerts = await db.driftAlert.findMany({
      where: { resolved: false },
      orderBy: { createdAt: 'desc' },
    })

    // 5. Financial summary for the week
    const weekFinances = await db.financeEntry.findMany({
      where: {
        date: { gte: weekStartStr },
      },
      orderBy: { date: 'desc' },
    })

    const weekReceived = weekFinances
      .filter((f) => f.type === 'received')
      .reduce((sum, f) => sum + f.amount, 0)
    const weekSpent = weekFinances
      .filter((f) => f.type === 'spent')
      .reduce((sum, f) => sum + f.amount, 0)

    // 6. Goal completion stats
    const allGoals = await db.goal.findMany({
      include: { tasks: true },
    })

    const goalStats = {
      total: allGoals.length,
      notStarted: allGoals.filter((g) => g.status === 'Not Started').length,
      inProgress: allGoals.filter((g) => g.status === 'In Progress').length,
      completed: allGoals.filter((g) => g.status === 'Completed').length,
      paused: allGoals.filter((g) => g.status === 'Paused').length,
    }

    // Task completion stats
    const allTasks = allGoals.flatMap((g) => g.tasks)
    const taskStats = {
      total: allTasks.length,
      notStarted: allTasks.filter((t) => t.status === 'Not Started').length,
      inProgress: allTasks.filter((t) => t.status === 'In Progress').length,
      completed: allTasks.filter((t) => t.status === 'Completed').length,
      skipped: allTasks.filter((t) => t.status === 'Skipped').length,
    }

    // Goals by area
    const goalsByArea: Record<string, { total: number; completed: number; inProgress: number }> = {}
    for (const goal of allGoals) {
      if (!goalsByArea[goal.area]) {
        goalsByArea[goal.area] = { total: 0, completed: 0, inProgress: 0 }
      }
      goalsByArea[goal.area].total++
      if (goal.status === 'Completed') goalsByArea[goal.area].completed++
      if (goal.status === 'In Progress') goalsByArea[goal.area].inProgress++
    }

    // 7. Score trend (last 7 days)
    const sevenDaysAgoStr = formatDateInTimezone(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    const scoreTrend = await db.lifeAreaScore.findMany({
      where: { date: { gte: sevenDaysAgoStr } },
      orderBy: { date: 'asc' },
    })

    // 8. Streaks
    const streakRecords = await db.streak.findMany()
    const streaks = streakRecords.map(s => ({
      type: s.type,
      currentStreak: s.currentStreak,
      longestStreak: s.longestStreak,
      lastDate: s.lastDate,
    }))

    // 9. Today's quick log
    const todayQuickLog = await db.quickLog.findFirst({
      where: { date: today },
    })

    return NextResponse.json({
      todayScores,
      recentCheckIns: parsedCheckIns,
      nextCheckIn: {
        ...nextCheckIn,
        alreadyCompleted: completedCheckInTypes.includes(nextCheckIn.type),
      },
      completedCheckInTypes,
      activeAlerts,
      financialSummary: {
        weekReceived,
        weekSpent,
        weekNet: weekReceived - weekSpent,
        entryCount: weekFinances.length,
      },
      goalStats,
      taskStats,
      goalsByArea,
      scoreTrend,
      streaks,
      todayQuickLog,
    })
  } catch (error) {
    console.error('Dashboard GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
