import { db } from '@/lib/db'
import { getTodayInTimezone, formatDateInTimezone } from '@/lib/utils'

/**
 * Recalculates streaks for the given types.
 * Call this after any check-in, mood log, or activity is recorded.
 */
export async function recalcStreaks(checkInType?: string): Promise<void> {
  const today = getTodayInTimezone()
  const typesToCalc: string[] = ['overall']
  if (checkInType === 'morning' || checkInType === 'evening') typesToCalc.push(checkInType)
  if (checkInType) typesToCalc.push('mood')

  for (const type of typesToCalc) {
    try {
      await recalcSingleStreak(type, today)
    } catch (err) {
      console.error(`Streak recalc error for type=${type}:`, err)
    }
  }
}

async function recalcSingleStreak(type: string, today: string): Promise<void> {
  if (type === 'mood') {
    const quickLogs = await db.quickLog.findMany({ orderBy: { date: 'desc' }, take: 90 })
    if (quickLogs.length === 0) {
      await upsertStreak(type, 0, 0, null)
      return
    }
    const logDates = new Set(quickLogs.map(l => l.date))
    const { current, longest } = calcStreak(logDates, today)
    await upsertStreak(type, current, longest, quickLogs[0]?.date || null)

  } else if (type === 'morning' || type === 'evening') {
    const checkIns = await db.checkIn.findMany({ where: { type }, orderBy: { date: 'desc' }, take: 90 })
    if (checkIns.length === 0) {
      await upsertStreak(type, 0, 0, null)
      return
    }
    const dates = new Set(checkIns.map(ci => ci.date))
    const { current, longest } = calcStreak(dates, today)
    await upsertStreak(type, current, longest, checkIns[0]?.date || null)

  } else if (type === 'overall') {
    const [allCheckIns, quickLogs] = await Promise.all([
      db.checkIn.findMany({ orderBy: { date: 'desc' }, take: 90 }),
      db.quickLog.findMany({ orderBy: { date: 'desc' }, take: 90 }),
    ])
    const allDates = new Set([...allCheckIns.map(ci => ci.date), ...quickLogs.map(l => l.date)])
    if (allDates.size === 0) {
      await upsertStreak(type, 0, 0, null)
      return
    }
    const { current, longest } = calcStreak(allDates, today)
    const sorted = [...allDates].sort().reverse()
    await upsertStreak(type, current, longest, sorted[0] || null)
  }
}

function calcStreak(dates: Set<string>, today: string): { current: number; longest: number } {
  const sorted = [...dates].sort().reverse()

  // Current streak: walk backwards from today
  let current = 0
  const d = new Date()
  if (!dates.has(today)) d.setDate(d.getDate() - 1)
  let cd = formatDateInTimezone(d)
  while (dates.has(cd)) {
    current++
    d.setDate(d.getDate() - 1)
    cd = formatDateInTimezone(d)
  }

  // Longest streak: scan sorted array
  let longest = current
  let temp = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round((new Date(sorted[i - 1]).getTime() - new Date(sorted[i]).getTime()) / 86400000)
    if (diff === 1) {
      temp++
      longest = Math.max(longest, temp)
    } else {
      temp = 1
    }
  }

  return { current, longest: Math.max(longest, current) }
}

async function upsertStreak(type: string, currentStreak: number, longestStreak: number, lastDate: string | null) {
  await db.streak.upsert({
    where: { type },
    update: { currentStreak, longestStreak, lastDate },
    create: { type, currentStreak, longestStreak, lastDate },
  })
}
