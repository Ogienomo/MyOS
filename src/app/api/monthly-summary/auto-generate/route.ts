import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

const AREA_NAMES: Record<string, string> = {
  faith: 'Faith & Spiritual Life',
  health: 'Health & Wellness',
  career: 'Career & Professional Growth',
  havilah: 'Business & Entrepreneurship',
  finances: 'Finances & Stewardship',
  relationships: 'Relationships & Community',
  personalGrowth: 'Personal Growth & Learning',
}

const ALL_AREAS = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth']

// POST - Auto-generate monthly summaries for all 7 life areas
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { month } = body as { month?: string }

    // Default to last month if no month specified
    const targetMonth = month || (() => {
      const now = new Date()
      const m = now.getMonth() === 0 ? 12 : now.getMonth() // 0-indexed, so current month - 1 gives last month
      const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
      return `${y}-${String(m).padStart(2, '0')}`
    })()

    const results = []

    for (const areaKey of ALL_AREAS) {
      try {
        const summary = await generateSummaryForArea(areaKey, targetMonth)
        results.push({ area: areaKey, success: true, summary })
      } catch (err) {
        console.error(`Failed to generate summary for ${areaKey}:`, err)
        results.push({ area: areaKey, success: false, error: 'Generation failed' })
      }
    }

    const successCount = results.filter(r => r.success).length

    return NextResponse.json({
      results,
      month: targetMonth,
      generated: successCount,
      total: ALL_AREAS.length,
    })
  } catch (error) {
    console.error('Auto-generate monthly summary error:', error)
    return NextResponse.json({ error: 'Failed to auto-generate monthly summaries' }, { status: 500 })
  }
}

async function generateSummaryForArea(area: string, month: string) {
  const areaName = AREA_NAMES[area] || area

  // Calculate date range for the month
  const [year, mon] = month.split('-').map(Number)
  const startDate = `${year}-${String(mon).padStart(2, '0')}-01`
  const endDate = mon === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(mon + 1).padStart(2, '0')}-01`

  // 1. Gather LifeAreaScore entries for the month
  const scores = await db.lifeAreaScore.findMany({
    where: { date: { gte: startDate, lt: endDate } },
    orderBy: { date: 'asc' },
  })

  // 2. Gather JournalEntry entries for the month in that area
  const journals = await db.journalEntry.findMany({
    where: {
      area,
      date: { gte: startDate, lt: endDate },
    },
    orderBy: { date: 'desc' },
  })

  // 3. Gather Goal entries in that area (with status)
  const goals = await db.goal.findMany({
    where: { area },
    include: { tasks: true },
  })

  // 4. Gather Memory entries for the month in that area
  const memories = await db.memory.findMany({
    where: {
      area,
      date: { gte: startDate, lt: endDate },
    },
  })

  // 5. Gather DriftAlert entries for the month in that area
  const driftAlerts = await db.driftAlert.findMany({
    where: {
      area,
      date: { gte: startDate, lt: endDate },
    },
  })

  // 6. FinanceEntry totals if area is "finances"
  let financeContext = ''
  if (area === 'finances') {
    const financeEntries = await db.financeEntry.findMany({
      where: { date: { gte: startDate, lt: endDate } },
    })
    const totalReceived = financeEntries.filter(e => e.type === 'received').reduce((sum, e) => sum + e.amount, 0)
    const totalSpent = financeEntries.filter(e => e.type === 'spent').reduce((sum, e) => sum + e.amount, 0)
    const topCategories: Record<string, number> = {}
    financeEntries.filter(e => e.type === 'spent').forEach(e => {
      topCategories[e.category] = (topCategories[e.category] || 0) + e.amount
    })
    const sortedCategories = Object.entries(topCategories).sort(([, a], [, b]) => b - a).slice(0, 5)
    financeContext = `
- Total Income: ₦${totalReceived.toLocaleString()}
- Total Expenses: ₦${totalSpent.toLocaleString()}
- Net: ₦${(totalReceived - totalSpent).toLocaleString()}
- Top spending categories: ${sortedCategories.map(([cat, amt]) => `${cat} (₦${amt.toLocaleString()})`).join(', ')}
- Total transactions: ${financeEntries.length}
`
  }

  // 7. HabitLog completion rate for habits in that area
  let habitContext = ''
  const habits = await db.habit.findMany({
    where: { area, active: true },
    include: {
      logs: {
        where: { date: { gte: startDate, lt: endDate } },
      },
    },
  })
  if (habits.length > 0) {
    const habitStats = habits.map(h => {
      const completedDays = h.logs.filter(l => l.completed).length
      const totalDaysInMonth = Math.max(1, new Date(year, mon, 0).getDate())
      const rate = Math.round((completedDays / totalDaysInMonth) * 100)
      return `${h.title}: ${completedDays}/${totalDaysInMonth} days (${rate}%)`
    })
    habitContext = `- Habit completion rates: ${habitStats.join(', ')}`
  }

  // Calculate score data
  const areaKey = area as keyof typeof scores[0]
  const areaScores = scores.map(s => ({
    date: s.date,
    score: (s[areaKey] as number) ?? 0,
  }))

  const avgScore = areaScores.length > 0
    ? (areaScores.reduce((sum, s) => sum + s.score, 0) / areaScores.length).toFixed(1)
    : 'N/A'

  const firstWeekScore = areaScores.length > 0
    ? areaScores.slice(0, Math.ceil(areaScores.length / 4)).reduce((sum, s) => sum + s.score, 0) /
      Math.ceil(areaScores.length / 4)
    : null

  const lastWeekScore = areaScores.length > 0
    ? areaScores.slice(-Math.ceil(areaScores.length / 4)).reduce((sum, s) => sum + s.score, 0) /
      Math.ceil(areaScores.length / 4)
    : null

  const scoreTrend = firstWeekScore !== null && lastWeekScore !== null
    ? `${firstWeekScore.toFixed(1)} → ${lastWeekScore.toFixed(1)}`
    : 'N/A'

  // Extract key themes from journal entries
  const journalThemes = journals.length > 0
    ? journals.slice(0, 10).map(j => {
        const content = j.content.substring(0, 100)
        return `[${j.date}] ${j.title || 'Entry'}: ${content}${j.content.length > 100 ? '...' : ''}`
      }).join('\n')
    : 'No journal entries this month'

  // Goals summary
  const activeGoals = goals.filter(g => g.status === 'In Progress' || g.status === 'Not Started').length
  const completedGoals = goals.filter(g => g.status === 'Completed').length

  // Key events from journal
  const keyEvents = journals.slice(0, 5).map(j =>
    `- [${j.date}] ${j.title || 'Entry'} (mood: ${j.mood || 'not recorded'})`
  ).join('\n')

  // Build AI prompt
  const prompt = `You are the AI assistant for MyOS, a personal life operating system. Generate a monthly summary for the "${areaName}" life area for ${month}.

Data for context:
- Average score this month: ${avgScore}/10
- Score trend: ${scoreTrend}
- Journal entries: ${journals.length} entries
- Key journal themes:
${journalThemes}
- Goals: ${activeGoals} active, ${completedGoals} completed
- Goals detail: ${goals.map(g => `${g.title} (${g.status}, ${g.tasks.filter(t => t.status === 'Completed').length}/${g.tasks.length} tasks done)`).join(', ') || 'No goals'}
- Memories recorded: ${memories.length} (${memories.map(m => `[${m.type}] ${m.content.substring(0, 80)}`).join(', ') || 'none'})
- Drift alerts: ${driftAlerts.length} (${driftAlerts.map(d => `${d.severity}: ${d.message.substring(0, 60)}`).join('; ') || 'none'})
- Key events:
${keyEvents || 'No key events recorded'}
${financeContext ? `- Finance details:\n${financeContext}` : ''}
${habitContext ? habitContext : ''}

Write a concise but insightful monthly summary (3-5 paragraphs) that:
1. Recaps the month's highlights and challenges
2. Notes any patterns or trends
3. Celebrates wins
4. Identifies areas for improvement
5. Suggests focus areas for next month

Also provide at the end (on separate lines):
HIGHLIGHTS: [a JSON array of 3-5 key highlight strings]
SCORE: [a number 0-10 representing the overall score for this area this month]

Example format for the last two lines:
HIGHLIGHTS: ["Completed 3 faith goals", "Prayer streak of 14 days", "Missed 2 Sunday services"]
SCORE: 7`

  // Call the AI
  const zai = await ZAI.create()
  const response = await zai.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    thinking: { type: 'disabled' },
  })

  const responseText = response?.choices?.[0]?.message?.content ||
    response?.choices?.[0]?.content ||
    ''

  if (!responseText) {
    throw new Error('AI returned empty response')
  }

  // Parse the response to extract summary, highlights, and score
  let summaryText = responseText
  let highlights: string[] = []
  let monthlyScore: number | null = null

  // Extract highlights
  const highlightsMatch = responseText.match(/HIGHLIGHTS:\s*(\[.*?\])/s)
  if (highlightsMatch) {
    try {
      highlights = JSON.parse(highlightsMatch[1])
      // Remove the HIGHLIGHTS line from summary
      summaryText = summaryText.replace(/HIGHLIGHTS:\s*\[.*?\]/s, '').trim()
    } catch {
      highlights = []
    }
  }

  // Extract score
  const scoreMatch = responseText.match(/SCORE:\s*(\d+)/)
  if (scoreMatch) {
    monthlyScore = Math.min(10, Math.max(0, parseInt(scoreMatch[1], 10)))
    // Remove the SCORE line from summary
    summaryText = summaryText.replace(/SCORE:\s*\d+/, '').trim()
  }

  // If no AI-parsed score, fall back to calculated average
  if (monthlyScore === null && areaScores.length > 0) {
    monthlyScore = Math.round(areaScores.reduce((sum, s) => sum + s.score, 0) / areaScores.length)
  }

  // If no AI-parsed highlights, generate defaults
  if (highlights.length === 0) {
    highlights = [
      `${journals.length} journal entries recorded`,
      `${activeGoals} active goals, ${completedGoals} completed`,
      monthlyScore ? `Average score: ${monthlyScore}/10` : 'No scores recorded',
    ]
  }

  // Upsert into MonthlySummary table
  const summary = await db.monthlySummary.upsert({
    where: { area_month: { area, month } },
    update: {
      summary: summaryText,
      highlights: JSON.stringify(highlights),
      score: monthlyScore,
    },
    create: {
      area,
      month,
      summary: summaryText,
      highlights: JSON.stringify(highlights),
      score: monthlyScore,
    },
  })

  return summary
}
