import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userid'

// Helper: get Monday of the week containing the given date
function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

// Helper: get Sunday of the week
function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00')
  d.setDate(d.getDate() + 6)
  return d.toISOString().split('T')[0]
}

interface WeekScores {
  faith: number
  health: number
  career: number
  havilah: number
  finances: number
  relationships: number
  personalGrowth: number
  overall: number
}

function avgScores(scores: Array<{ faith: number; health: number; career: number; havilah: number; finances: number; relationships: number; personalGrowth: number; overall: number }>): WeekScores {
  if (scores.length === 0) {
    return { faith: 0, health: 0, career: 0, havilah: 0, finances: 0, relationships: 0, personalGrowth: 0, overall: 0 }
  }
  const n = scores.length
  return {
    faith: Math.round(scores.reduce((s, x) => s + x.faith, 0) / n * 10) / 10,
    health: Math.round(scores.reduce((s, x) => s + x.health, 0) / n * 10) / 10,
    career: Math.round(scores.reduce((s, x) => s + x.career, 0) / n * 10) / 10,
    havilah: Math.round(scores.reduce((s, x) => s + x.havilah, 0) / n * 10) / 10,
    finances: Math.round(scores.reduce((s, x) => s + x.finances, 0) / n * 10) / 10,
    relationships: Math.round(scores.reduce((s, x) => s + x.relationships, 0) / n * 10) / 10,
    personalGrowth: Math.round(scores.reduce((s, x) => s + x.personalGrowth, 0) / n * 10) / 10,
    overall: Math.round(scores.reduce((s, x) => s + x.overall, 0) / n * 10) / 10,
  }
}

// Calculate week grade based on various metrics
function calculateWeekGrade(data: {
  checkInsCompleted: string[]
  scoreChanges: Record<string, number>
  completedGoals: number
  inProgressGoals: number
  totalGoals: number
  habitsCompleted: number
  habitsTotal: number
  avgMood: number
  journalEntries: number
}): { grade: string; comment: string } {
  let points = 0
  const maxPoints = 100

  // Consistency: check-in completion (0-25)
  const checkInTypes = ['morning', 'midday', 'evening', 'friday', 'sunday']
  const uniqueCheckIns = new Set(data.checkInsCompleted.map(c => c.toLowerCase()))
  const checkInScore = Math.min(25, (uniqueCheckIns.size / checkInTypes.length) * 25)
  points += checkInScore

  // Score changes (0-25)
  const areas = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth']
  const positiveChanges = areas.filter(a => (data.scoreChanges[a] || 0) > 0).length
  const negativeChanges = areas.filter(a => (data.scoreChanges[a] || 0) < 0).length
  const scoreScore = Math.max(0, Math.min(25, 12.5 + (positiveChanges - negativeChanges) * 3))
  points += scoreScore

  // Goal progress (0-20)
  const goalProgress = data.totalGoals > 0 ? (data.completedGoals + data.inProgressGoals * 0.5) / data.totalGoals : 0.5
  points += Math.min(20, goalProgress * 20)

  // Habit completion (0-15)
  const habitRate = data.habitsTotal > 0 ? data.habitsCompleted / data.habitsTotal : 0
  points += Math.min(15, habitRate * 15)

  // Mood (0-15)
  points += Math.min(15, (data.avgMood / 10) * 15)

  const percentage = points / maxPoints

  let grade: string
  if (percentage >= 0.95) grade = 'A+'
  else if (percentage >= 0.88) grade = 'A'
  else if (percentage >= 0.82) grade = 'A-'
  else if (percentage >= 0.76) grade = 'B+'
  else if (percentage >= 0.70) grade = 'B'
  else if (percentage >= 0.64) grade = 'B-'
  else if (percentage >= 0.58) grade = 'C+'
  else if (percentage >= 0.52) grade = 'C'
  else if (percentage >= 0.46) grade = 'C-'
  else if (percentage >= 0.40) grade = 'D+'
  else if (percentage >= 0.34) grade = 'D'
  else if (percentage >= 0.25) grade = 'D-'
  else grade = 'F'

  // Generate comment
  const comments: string[] = []
  if (uniqueCheckIns.size >= 3) comments.push('Great consistency with check-ins')
  else if (uniqueCheckIns.size === 0) comments.push('No check-ins this week — try to stay consistent')
  else comments.push('Some check-ins done — room for improvement')

  if (positiveChanges > negativeChanges) comments.push('Scores trending upward overall')
  else if (negativeChanges > positiveChanges) comments.push('Some scores dipped — focus on recovery next week')

  if (habitRate >= 0.8) comments.push('Excellent habit discipline')
  else if (habitRate < 0.3 && data.habitsTotal > 0) comments.push('Habits need attention')

  if (data.avgMood >= 7) comments.push('Strong mood this week')
  else if (data.avgMood <= 4) comments.push('Mood was low — prioritize self-care')

  if (data.journalEntries >= 5) comments.push('Great journaling consistency')

  return { grade, comment: comments.join('. ') + '.' }
}

// GET /api/weekly-review?date=2026-03-15
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request)
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0]

    const thisWeekStart = getWeekStart(dateParam)
    const thisWeekEnd = getWeekEnd(thisWeekStart)

    // Previous week
    const prevWeekStartDate = new Date(thisWeekStart + 'T00:00:00')
    prevWeekStartDate.setDate(prevWeekStartDate.getDate() - 7)
    const lastWeekStart = prevWeekStartDate.toISOString().split('T')[0]
    const lastWeekEnd = getWeekEnd(lastWeekStart)

    // Fetch this week data
    const [
      thisWeekScores,
      thisWeekGoals,
      thisWeekFinances,
      thisWeekQuickLogs,
      thisWeekCheckIns,
      thisWeekJournals,
      thisWeekMemories,
      thisWeekHabits,
      thisWeekHabitLogs,
      reviewNote,
    ] = await Promise.all([
      db.lifeAreaScore.findMany({ where: { userId, date: { gte: thisWeekStart, lte: thisWeekEnd } }, orderBy: { date: 'asc' } }),
      db.goal.findMany({ where: { userId }, include: { tasks: true } }),
      db.financeEntry.findMany({ where: { userId, date: { gte: thisWeekStart, lte: thisWeekEnd } }, orderBy: { date: 'desc' } }),
      db.quickLog.findMany({ where: { userId, date: { gte: thisWeekStart, lte: thisWeekEnd } }, orderBy: { date: 'asc' } }),
      db.checkIn.findMany({ where: { userId, date: { gte: thisWeekStart, lte: thisWeekEnd } } }),
      db.journalEntry.findMany({ where: { userId, date: { gte: thisWeekStart, lte: thisWeekEnd } } }),
      db.memory.findMany({ where: { userId, date: { gte: thisWeekStart, lte: thisWeekEnd } } }),
      db.habit.findMany({ where: { userId, active: true } }),
      db.habitLog.findMany({ where: { date: { gte: thisWeekStart, lte: thisWeekEnd } } }),
      db.weeklyReviewNote.findUnique({ where: { userId_weekStart: { userId, weekStart: thisWeekStart } } }),
    ])

    // Fetch last week data
    const [lastWeekScores, lastWeekQuickLogs] = await Promise.all([
      db.lifeAreaScore.findMany({ where: { userId, date: { gte: lastWeekStart, lte: lastWeekEnd } }, orderBy: { date: 'asc' } }),
      db.quickLog.findMany({ where: { userId, date: { gte: lastWeekStart, lte: lastWeekEnd } }, orderBy: { date: 'asc' } }),
    ])

    // Scores
    const thisWeekScoresAvg = avgScores(thisWeekScores)
    const lastWeekScoresAvg = avgScores(lastWeekScores)

    // Score changes
    const areas = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth', 'overall'] as const
    const scoreChanges: Record<string, number> = {}
    for (const area of areas) {
      const diff = thisWeekScoresAvg[area] - lastWeekScoresAvg[area]
      scoreChanges[area] = Math.round(diff * 10) / 10
    }

    // Goals
    const completedGoals = thisWeekGoals.filter(g => g.status === 'Completed').map(g => ({ id: g.id, title: g.title, area: g.area }))
    const inProgressGoals = thisWeekGoals.filter(g => g.status === 'In Progress').map(g => ({ id: g.id, title: g.title, area: g.area, status: g.status }))

    // Finances
    const received = thisWeekFinances.filter(f => f.type === 'received').reduce((s, f) => s + f.amount, 0)
    const spent = thisWeekFinances.filter(f => f.type === 'spent').reduce((s, f) => s + f.amount, 0)
    const categoryMap: Record<string, number> = {}
    for (const f of thisWeekFinances.filter(f => f.type === 'spent')) {
      categoryMap[f.category] = (categoryMap[f.category] || 0) + f.amount
    }
    const topCategories = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))

    // Mood
    const moodAvg = thisWeekQuickLogs.length > 0 ? Math.round(thisWeekQuickLogs.reduce((s, l) => s + l.mood, 0) / thisWeekQuickLogs.length * 10) / 10 : 0
    const energyAvg = thisWeekQuickLogs.length > 0 ? Math.round(thisWeekQuickLogs.reduce((s, l) => s + l.energy, 0) / thisWeekQuickLogs.length * 10) / 10 : 0
    const focusAvg = thisWeekQuickLogs.length > 0 ? Math.round(thisWeekQuickLogs.reduce((s, l) => s + l.focus, 0) / thisWeekQuickLogs.length * 10) / 10 : 0

    // Mood trend by day
    const byDate: Record<string, { mood: number[]; energy: number[]; focus: number[] }> = {}
    for (const log of thisWeekQuickLogs) {
      if (!byDate[log.date]) byDate[log.date] = { mood: [], energy: [], focus: [] }
      byDate[log.date].mood.push(log.mood)
      byDate[log.date].energy.push(log.energy)
      byDate[log.date].focus.push(log.focus)
    }
    const moodTrend = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({
        date,
        mood: Math.round(vals.mood.reduce((a, b) => a + b, 0) / vals.mood.length * 10) / 10,
        energy: Math.round(vals.energy.reduce((a, b) => a + b, 0) / vals.energy.length * 10) / 10,
        focus: Math.round(vals.focus.reduce((a, b) => a + b, 0) / vals.focus.length * 10) / 10,
      }))

    // Last week mood
    const lastWeekMoodAvg = lastWeekQuickLogs.length > 0 ? Math.round(lastWeekQuickLogs.reduce((s, l) => s + l.mood, 0) / lastWeekQuickLogs.length * 10) / 10 : 0
    const lastWeekEnergyAvg = lastWeekQuickLogs.length > 0 ? Math.round(lastWeekQuickLogs.reduce((s, l) => s + l.energy, 0) / lastWeekQuickLogs.length * 10) / 10 : 0
    const lastWeekFocusAvg = lastWeekQuickLogs.length > 0 ? Math.round(lastWeekQuickLogs.reduce((s, l) => s + l.focus, 0) / lastWeekQuickLogs.length * 10) / 10 : 0

    // Habits
    const totalHabitSlots = thisWeekHabits.length * 7 // Max possible completions for daily habits
    const habitCompletedCount = thisWeekHabitLogs.filter(l => l.completed).length
    const habitRate = totalHabitSlots > 0 ? Math.round((habitCompletedCount / totalHabitSlots) * 100) / 100 : 0

    // Check-ins
    const checkInsCompleted = [...new Set(thisWeekCheckIns.map(c => c.type))]

    // Last week data summary
    const lastWeekFinances = await db.financeEntry.findMany({ where: { userId, date: { gte: lastWeekStart, lte: lastWeekEnd } } })
    const lastWeekReceived = lastWeekFinances.filter(f => f.type === 'received').reduce((s, f) => s + f.amount, 0)
    const lastWeekSpent = lastWeekFinances.filter(f => f.type === 'spent').reduce((s, f) => s + f.amount, 0)
    const lastWeekJournals = await db.journalEntry.findMany({ where: { userId, date: { gte: lastWeekStart, lte: lastWeekEnd } } })
    const lastWeekCheckIns = await db.checkIn.findMany({ where: { userId, date: { gte: lastWeekStart, lte: lastWeekEnd } } })
    const lastWeekMemories = await db.memory.findMany({ where: { userId, date: { gte: lastWeekStart, lte: lastWeekEnd } } })
    const lastWeekHabitLogs = await db.habitLog.findMany({ where: { date: { gte: lastWeekStart, lte: lastWeekEnd } } })
    const lastWeekGoals = await db.goal.findMany({ where: { userId }, include: { tasks: true } })
    const lastWeekHabits = await db.habit.findMany({ where: { userId, active: true } })

    const lastWeekCompletedGoals = lastWeekGoals.filter(g => g.status === 'Completed').map(g => ({ id: g.id, title: g.title, area: g.area }))
    const lastWeekInProgressGoals = lastWeekGoals.filter(g => g.status === 'In Progress').map(g => ({ id: g.id, title: g.title, area: g.area, status: g.status }))
    const lastWeekCategoryMap: Record<string, number> = {}
    for (const f of lastWeekFinances.filter(f => f.type === 'spent')) {
      lastWeekCategoryMap[f.category] = (lastWeekCategoryMap[f.category] || 0) + f.amount
    }
    const lastWeekTopCategories = Object.entries(lastWeekCategoryMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))

    const lastWeekTotalSlots = lastWeekHabits.length * 7
    const lastWeekHabitCompleted = lastWeekHabitLogs.filter(l => l.completed).length
    const lastWeekHabitRate = lastWeekTotalSlots > 0 ? Math.round((lastWeekHabitCompleted / lastWeekTotalSlots) * 100) / 100 : 0

    // Last week mood trend
    const lastWeekByDate: Record<string, { mood: number[]; energy: number[]; focus: number[] }> = {}
    for (const log of lastWeekQuickLogs) {
      if (!lastWeekByDate[log.date]) lastWeekByDate[log.date] = { mood: [], energy: [], focus: [] }
      lastWeekByDate[log.date].mood.push(log.mood)
      lastWeekByDate[log.date].energy.push(log.energy)
      lastWeekByDate[log.date].focus.push(log.focus)
    }
    const lastWeekMoodTrend = Object.entries(lastWeekByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({
        date,
        mood: Math.round(vals.mood.reduce((a, b) => a + b, 0) / vals.mood.length * 10) / 10,
        energy: Math.round(vals.energy.reduce((a, b) => a + b, 0) / vals.energy.length * 10) / 10,
        focus: Math.round(vals.focus.reduce((a, b) => a + b, 0) / vals.focus.length * 10) / 10,
      }))

    // Calculate week grade
    const { grade, comment } = calculateWeekGrade({
      checkInsCompleted,
      scoreChanges,
      completedGoals: completedGoals.length,
      inProgressGoals: inProgressGoals.length,
      totalGoals: thisWeekGoals.length,
      habitsCompleted: habitCompletedCount,
      habitsTotal: totalHabitSlots,
      avgMood: moodAvg,
      journalEntries: thisWeekJournals.length,
    })

    return NextResponse.json({
      thisWeek: {
        scores: thisWeekScoresAvg,
        completedGoals,
        inProgressGoals,
        finances: { received, spent, net: received - spent, topCategories },
        moodAvg: { mood: moodAvg, energy: energyAvg, focus: focusAvg },
        moodTrend,
        habitsCompleted: { completed: habitCompletedCount, total: totalHabitSlots, rate: habitRate },
        checkInsCompleted,
        journalEntries: thisWeekJournals.length,
        memories: thisWeekMemories.map(m => ({ type: m.type, content: m.content, area: m.area })),
      },
      lastWeek: {
        scores: lastWeekScoresAvg,
        completedGoals: lastWeekCompletedGoals,
        inProgressGoals: lastWeekInProgressGoals,
        finances: { received: lastWeekReceived, spent: lastWeekSpent, net: lastWeekReceived - lastWeekSpent, topCategories: lastWeekTopCategories },
        moodAvg: { mood: lastWeekMoodAvg, energy: lastWeekEnergyAvg, focus: lastWeekFocusAvg },
        moodTrend: lastWeekMoodTrend,
        habitsCompleted: { completed: lastWeekHabitCompleted, total: lastWeekTotalSlots, rate: lastWeekHabitRate },
        checkInsCompleted: [...new Set(lastWeekCheckIns.map(c => c.type))],
        journalEntries: lastWeekJournals.length,
        memories: lastWeekMemories.map(m => ({ type: m.type, content: m.content, area: m.area })),
      },
      scoreChanges,
      weekGrade: grade,
      weekComment: comment,
      weekStart: thisWeekStart,
      weekEnd: thisWeekEnd,
      reviewNote: reviewNote ? {
        whatILearned: reviewNote.whatILearned,
        nextWeekFocus: reviewNote.nextWeekFocus,
      } : null,
    })
  } catch (error) {
    console.error('Weekly review GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch weekly review' }, { status: 500 })
  }
}

// POST /api/weekly-review — Save review notes
export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request)
    const { weekStart, whatILearned, nextWeekFocus } = await request.json() as { weekStart: string; whatILearned?: string; nextWeekFocus?: string }

    if (!weekStart) {
      return NextResponse.json({ error: 'weekStart is required' }, { status: 400 })
    }

    const note = await db.weeklyReviewNote.upsert({
      where: { userId_weekStart: { userId, weekStart } },
      update: {
        ...(whatILearned !== undefined && { whatILearned }),
        ...(nextWeekFocus !== undefined && { nextWeekFocus }),
      },
      create: {
        userId,
        weekStart,
        whatILearned: whatILearned || null,
        nextWeekFocus: nextWeekFocus || null,
      },
    })

    return NextResponse.json({ note })
  } catch (error) {
    console.error('Weekly review POST error:', error)
    return NextResponse.json({ error: 'Failed to save review notes' }, { status: 500 })
  }
}
