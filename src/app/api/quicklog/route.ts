import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTodayInTimezone, formatDateInTimezone } from '@/lib/utils'

// Recalculate and persist mood streak
async function recalcMoodStreak() {
  try {
    const today = getTodayInTimezone()
    const quickLogs = await db.quickLog.findMany({
      orderBy: { date: 'desc' },
      take: 60,
    })

    if (quickLogs.length === 0) {
      await db.streak.upsert({
        where: { type: 'mood' },
        update: { currentStreak: 0, longestStreak: 0, lastDate: null },
        create: { type: 'mood', currentStreak: 0, longestStreak: 0, lastDate: null },
      })
      return
    }

    const logDates = new Set(quickLogs.map(l => l.date))
    let currentStreak = 0
    const dateStr = new Date()

    const todayHas = logDates.has(today)
    if (!todayHas) {
      dateStr.setDate(dateStr.getDate() - 1)
    }

    let checkDate = formatDateInTimezone(dateStr)
    while (logDates.has(checkDate)) {
      currentStreak++
      dateStr.setDate(dateStr.getDate() - 1)
      checkDate = formatDateInTimezone(dateStr)
    }

    // Calculate longest
    const sortedDates = [...logDates].sort().reverse()
    let longestStreak = currentStreak
    let tempStreak = 1
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1])
      const curr = new Date(sortedDates[i])
      const diffDays = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays === 1) {
        tempStreak++
        longestStreak = Math.max(longestStreak, tempStreak)
      } else {
        tempStreak = 1
      }
    }

    await db.streak.upsert({
      where: { type: 'mood' },
      update: { currentStreak, longestStreak: Math.max(longestStreak, currentStreak), lastDate: quickLogs[0]?.date || null },
      create: { type: 'mood', currentStreak, longestStreak: Math.max(longestStreak, currentStreak), lastDate: quickLogs[0]?.date || null },
    })
  } catch (err) {
    console.error('Failed to recalc mood streak:', err)
  }
}

// Recalculate overall streak (any check-in or mood log per day)
async function recalcOverallStreak() {
  try {
    const today = getTodayInTimezone()

    const [allCheckIns, quickLogs] = await Promise.all([
      db.checkIn.findMany({ orderBy: { date: 'desc' }, take: 60 }),
      db.quickLog.findMany({ orderBy: { date: 'desc' }, take: 60 }),
    ])

    const allDates = new Set([
      ...allCheckIns.map(ci => ci.date),
      ...quickLogs.map(l => l.date),
    ])

    if (allDates.size === 0) {
      await db.streak.upsert({
        where: { type: 'overall' },
        update: { currentStreak: 0, longestStreak: 0, lastDate: null },
        create: { type: 'overall', currentStreak: 0, longestStreak: 0, lastDate: null },
      })
      return
    }

    let currentStreak = 0
    const dateStr = new Date()
    const todayHas = allDates.has(today)
    if (!todayHas) {
      dateStr.setDate(dateStr.getDate() - 1)
    }

    let checkDate = formatDateInTimezone(dateStr)
    while (allDates.has(checkDate)) {
      currentStreak++
      dateStr.setDate(dateStr.getDate() - 1)
      checkDate = formatDateInTimezone(dateStr)
    }

    const sortedDates = [...allDates].sort().reverse()
    let longestStreak = currentStreak
    let tempStreak = 1
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1])
      const curr = new Date(sortedDates[i])
      const diffDays = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays === 1) {
        tempStreak++
        longestStreak = Math.max(longestStreak, tempStreak)
      } else {
        tempStreak = 1
      }
    }

    const lastDate = sortedDates[0] || null
    await db.streak.upsert({
      where: { type: 'overall' },
      update: { currentStreak, longestStreak: Math.max(longestStreak, currentStreak), lastDate },
      create: { type: 'overall', currentStreak, longestStreak: Math.max(longestStreak, currentStreak), lastDate },
    })
  } catch (err) {
    console.error('Failed to recalc overall streak:', err)
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') // 'today' or 'recent' or 'week'
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    if (range === 'recent') {
      // Get recent logs for display
      const logs = await db.quickLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      return NextResponse.json({ logs })
    }

    if (range === 'week') {
      // Get logs from last 7 days for trend chart
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const weekAgoStr = formatDateInTimezone(sevenDaysAgo)
      const logs = await db.quickLog.findMany({
        where: { date: { gte: weekAgoStr } },
        orderBy: { date: 'asc' },
      })
      return NextResponse.json({ logs })
    }

    // Default: get today's most recent log
    const today = getTodayInTimezone()
    const log = await db.quickLog.findFirst({
      where: { date: today },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ log })
  } catch (error) {
    console.error('QuickLog GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch quick log' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { mood, energy, focus, note } = await request.json() as { mood: number; energy: number; focus: number; note?: string }

    if (mood === undefined || energy === undefined || focus === undefined) {
      return NextResponse.json({ error: 'Mood, energy, and focus are required' }, { status: 400 })
    }

    const today = getTodayInTimezone()
    const now = new Date()
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    // Allow multiple quick logs per day - use create instead of upsert
    const log = await db.quickLog.create({
      data: {
        date: today,
        time,
        mood: Math.min(10, Math.max(1, Number(mood))),
        energy: Math.min(10, Math.max(1, Number(energy))),
        focus: Math.min(10, Math.max(1, Number(focus))),
        note: note || null,
      },
    })

    // Recalculate mood and overall streaks after saving
    await Promise.all([recalcMoodStreak(), recalcOverallStreak()])

    return NextResponse.json({ log })
  } catch (error) {
    console.error('QuickLog POST error:', error)
    return NextResponse.json({ error: 'Failed to save quick log' }, { status: 500 })
  }
}
