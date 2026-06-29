import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTodayInTimezone, formatDateInTimezone } from '@/lib/utils'
import { getUserId } from '@/lib/userid'

async function calculateStreak(type: string, userId: string): Promise<{ currentStreak: number; longestStreak: number; lastDate: string | null }> {
  const today = getTodayInTimezone()

  // Get or create streak record
  let streak = await db.streak.findUnique({ where: { userId_type: { userId, type } } })
  if (!streak) {
    streak = await db.streak.create({
      data: { userId, type, currentStreak: 0, longestStreak: 0, lastDate: null },
    })
  }

  // For 'morning' and 'evening' streaks, calculate based on check-ins
  if (type === 'morning' || type === 'evening') {
    const checkIns = await db.checkIn.findMany({
      where: { userId, type },
      orderBy: { date: 'desc' },
      take: 60,
    })

    if (checkIns.length === 0) {
      return { currentStreak: 0, longestStreak: 0, lastDate: null }
    }

    let currentStreak = 0
    const checkInDates = new Set(checkIns.map(ci => ci.date))
    const dateStr = new Date()

    const todayHas = checkInDates.has(today)
    if (!todayHas) {
      dateStr.setDate(dateStr.getDate() - 1)
    }

    let checkDate = formatDateInTimezone(dateStr)
    while (checkInDates.has(checkDate)) {
      currentStreak++
      dateStr.setDate(dateStr.getDate() - 1)
      checkDate = formatDateInTimezone(dateStr)
    }

    const sortedDates = [...checkInDates].sort().reverse()
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

    await db.streak.update({
      where: { userId_type: { userId, type } },
      data: {
        currentStreak,
        longestStreak: Math.max(longestStreak, currentStreak),
        lastDate: checkIns[0]?.date || null,
      },
    })

    return { currentStreak, longestStreak: Math.max(longestStreak, currentStreak), lastDate: checkIns[0]?.date || null }
  }

  // For 'overall' streak, check if any check-in OR quick log happened each day
  if (type === 'overall') {
    const [allCheckIns, quickLogs] = await Promise.all([
      db.checkIn.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 60,
      }),
      db.quickLog.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 60,
      }),
    ])

    const allDates = new Set([
      ...allCheckIns.map(ci => ci.date),
      ...quickLogs.map(l => l.date),
    ])

    if (allDates.size === 0) {
      return { currentStreak: 0, longestStreak: 0, lastDate: null }
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

    await db.streak.update({
      where: { userId_type: { userId, type: 'overall' } },
      data: {
        currentStreak,
        longestStreak: Math.max(longestStreak, currentStreak),
        lastDate: sortedDates[0] || null,
      },
    })

    return { currentStreak, longestStreak: Math.max(longestStreak, currentStreak), lastDate: sortedDates[0] || null }
  }

  // For 'mood' streak, check if quick log was filled each day
  if (type === 'mood') {
    const quickLogs = await db.quickLog.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 60,
    })

    if (quickLogs.length === 0) {
      return { currentStreak: 0, longestStreak: 0, lastDate: null }
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
      where: { userId_type: { userId, type: 'mood' } },
      update: { currentStreak, longestStreak: Math.max(longestStreak, currentStreak), lastDate: quickLogs[0]?.date || null },
      create: { userId, type: 'mood', currentStreak, longestStreak: Math.max(longestStreak, currentStreak), lastDate: quickLogs[0]?.date || null },
    })

    return { currentStreak, longestStreak: Math.max(longestStreak, currentStreak), lastDate: quickLogs[0]?.date || null }
  }

  return { currentStreak: streak.currentStreak, longestStreak: streak.longestStreak, lastDate: streak.lastDate }
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request)
    const [morning, evening, overall, mood] = await Promise.all([
      calculateStreak('morning', userId),
      calculateStreak('evening', userId),
      calculateStreak('overall', userId),
      calculateStreak('mood', userId),
    ])

    return NextResponse.json({
      streaks: [
        { type: 'morning', ...morning },
        { type: 'evening', ...evening },
        { type: 'overall', ...overall },
        { type: 'mood', ...mood },
      ],
    })
  } catch (error) {
    console.error('Streaks GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch streaks' }, { status: 500 })
  }
}
