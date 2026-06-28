import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getZAI, MYOS_SYSTEM_PROMPT } from '@/lib/ai'

const AREA_NAMES: Record<string, string> = {
  faith: 'Faith & Spiritual Life',
  health: 'Health & Wellness',
  career: 'Career & Professional Growth',
  havilah: 'Havilah & Entrepreneurship',
  finances: 'Finances & Stewardship',
  relationships: 'Relationships & Community',
  personalGrowth: 'Personal Growth & Learning',
}

const ALL_AREAS = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth']

// GET - Fetch monthly summaries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const area = searchParams.get('area')
    const month = searchParams.get('month') // YYYY-MM

    const where: Record<string, string | { gte: string; lt: string } | undefined> = {}
    if (area) where.area = area
    if (month) where.month = month

    const summaries = await db.monthlySummary.findMany({
      where,
      orderBy: { month: 'desc' },
    })

    // Check if there's a new summary for current month that user hasn't seen
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const currentMonthSummary = area
      ? await db.monthlySummary.findUnique({ where: { area_month: { area, month: currentMonth } } })
      : null

    return NextResponse.json({
      summaries,
      currentMonthSummary,
      currentMonth,
    })
  } catch (error) {
    console.error('Monthly summary GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch summaries' }, { status: 500 })
  }
}

// POST - Generate a monthly summary for a specific area (or all areas)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { area, month, all } = body as { area?: string; month?: string; all?: boolean }

    const targetMonth = month || (() => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    })()

    if (all) {
      // Generate summaries for all 7 areas
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
      return NextResponse.json({ results, month: targetMonth })
    }

    if (!area) {
      return NextResponse.json({ error: 'Area is required (or use all=true)' }, { status: 400 })
    }

    const summary = await generateSummaryForArea(area, targetMonth)
    return NextResponse.json({ summary })
  } catch (error) {
    console.error('Monthly summary POST error:', error)
    return NextResponse.json({ error: 'Failed to generate monthly summary' }, { status: 500 })
  }
}

async function generateSummaryForArea(area: string, month: string) {
  const areaName = AREA_NAMES[area] || area

  // Gather data for the month
  const [year, mon] = month.split('-').map(Number)
  const startDate = `${year}-${String(mon).padStart(2, '0')}-01`
  const endDate = mon === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(mon + 1).padStart(2, '0')}-01`

  // Get check-ins for this month
  const checkIns = await db.checkIn.findMany({
    where: {
      date: { gte: startDate, lt: endDate },
    },
    orderBy: { date: 'desc' },
  })

  // Get scores for this month
  const scores = await db.lifeAreaScore.findMany({
    where: { date: { gte: startDate, lt: endDate } },
    orderBy: { date: 'asc' },
  })

  // Get goals for this area
  const goals = await db.goal.findMany({
    where: { area },
    include: { tasks: true },
  })

  // Get journal entries for this area/month
  const journals = await db.journalEntry.findMany({
    where: {
      area,
      date: { gte: startDate, lt: endDate },
    },
    orderBy: { date: 'desc' },
  })

  // Get memories for this area/month
  const memories = await db.memory.findMany({
    where: {
      area,
      date: { gte: startDate, lt: endDate },
    },
  })

  // Get finance data if area is finances
  let financeData: {
    totalReceived: number
    totalSpent: number
    net: number
    entryCount: number
    entries: { date: string; type: string; amount: number; category: string; purpose: string | null }[]
  } | null = null
  if (area === 'finances') {
    const entries = await db.financeEntry.findMany({
      where: { date: { gte: startDate, lt: endDate } },
    })
    const totalReceived = entries.filter(e => e.type === 'received').reduce((sum, e) => sum + e.amount, 0)
    const totalSpent = entries.filter(e => e.type === 'spent').reduce((sum, e) => sum + e.amount, 0)
    financeData = {
      totalReceived,
      totalSpent,
      net: totalReceived - totalSpent,
      entryCount: entries.length,
      entries: entries.slice(0, 20).map(e => ({
        date: e.date,
        type: e.type,
        amount: e.amount,
        category: e.category,
        purpose: e.purpose,
      })),
    }
  }

  // Build context for AI
  const contextParts: string[] = []
  contextParts.push(`MONTHLY SUMMARY REQUEST FOR: ${areaName}`)
  contextParts.push(`MONTH: ${month}`)
  contextParts.push(`NUMBER OF CHECK-INS THIS MONTH: ${checkIns.length}`)

  if (scores.length > 0) {
    const areaKey = area as keyof typeof scores[0]
    const areaScores = scores.map(s => `${s.date}: ${(s[areaKey] as number) ?? 'N/A'}/10`).join(', ')
    contextParts.push(`SCORES THIS MONTH: ${areaScores}`)
    const avgScore = scores.reduce((sum, s) => sum + ((s[areaKey] as number) ?? 0), 0) / scores.length
    contextParts.push(`AVERAGE SCORE: ${avgScore.toFixed(1)}/10`)
  }

  if (goals.length > 0) {
    contextParts.push('CURRENT GOALS:')
    for (const g of goals) {
      const done = g.tasks.filter(t => t.status === 'Completed').length
      contextParts.push(`  - ${g.title} (${g.status}, ${done}/${g.tasks.length} tasks)`)
    }
  }

  if (journals.length > 0) {
    contextParts.push(`JOURNAL ENTRIES: ${journals.length}`)
    for (const j of journals.slice(0, 5)) {
      contextParts.push(`  [${j.date}] ${j.title || 'Untitled'}: ${j.content.substring(0, 100)}...`)
    }
  }

  if (memories.length > 0) {
    contextParts.push('MEMORIES:')
    for (const m of memories) {
      contextParts.push(`  [${m.type}] ${m.content}`)
    }
  }

  if (financeData) {
    contextParts.push(`FINANCIAL SUMMARY: Received ₦${financeData.totalReceived.toLocaleString()}, Spent ₦${financeData.totalSpent.toLocaleString()}, Net ₦${financeData.net.toLocaleString()}`)
  }

  if (checkIns.length > 0) {
    contextParts.push('CHECK-IN DETAILS:')
    for (const ci of checkIns.slice(0, 5)) {
      contextParts.push(`  [${ci.type}] ${ci.date}`)
    }
  }

  // Generate AI summary
  const zai = await getZAI()
  const response = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: MYOS_SYSTEM_PROMPT },
      {
        role: 'system',
        content: `You are writing a monthly summary letter from MyOS (the AI coach) about your ${areaName} for the month of ${month}.

This is a personal, warm, direct, and honest monthly review letter. Write it as if you are your chief of staff giving her a detailed monthly briefing on this life area.

Format the letter with:
## Monthly Review: ${areaName} — ${month}

### Truth of the Month
[An honest assessment of where things stand]

### Score Trend
[How scores moved this month - upward, downward, stable]

### Wins & Progress
[What went well - specific wins and accomplishments]

### Areas of Concern
[What needs attention - be direct but constructive]

### Goals Progress
[Update on goals in this area]

### Coach's Recommendation for Next Month
[2-3 specific, actionable recommendations]

### Monthly Score: X/10
[Your assessment with justification]

Be warm but honest. Celebrate wins genuinely. Call out drift firmly. End with encouragement and specific action items.

Use proper markdown formatting with headers, bullet points, and bold text. Leave adequate spacing between sections.

If there is very little data for this area this month, still provide a meaningful review based on what you have, noting that engagement was limited and encouraging more check-ins next month.`,
      },
      {
        role: 'user',
        content: contextParts.join('\n'),
      },
    ],
    stream: false,
  })

  const summaryText = response?.choices?.[0]?.message?.content ||
    response?.choices?.[0]?.content ||
    `Monthly summary for ${areaName} - ${month}. Check-in data was limited this month. Let's aim for more consistent engagement next month.`

  // Calculate monthly score
  let monthlyScore: number | null = null
  if (scores.length > 0) {
    const areaKey = area as keyof typeof scores[0]
    monthlyScore = Math.round(scores.reduce((sum, s) => sum + ((s[areaKey] as number) ?? 0), 0) / scores.length)
  }

  // Extract highlights (first 3 key points)
  const highlights = JSON.stringify([
    `Check-ins: ${checkIns.length}`,
    `Journals: ${journals.length}`,
    monthlyScore ? `Avg Score: ${monthlyScore}/10` : 'No scores recorded',
  ])

  // Upsert the summary
  const summary = await db.monthlySummary.upsert({
    where: { area_month: { area, month } },
    update: {
      summary: summaryText,
      highlights,
      score: monthlyScore,
    },
    create: {
      area,
      month,
      summary: summaryText,
      highlights,
      score: monthlyScore,
    },
  })

  return summary
}
