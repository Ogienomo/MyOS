import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getZAI } from '@/lib/ai'

// GET /api/insights/weekly — AI-generated weekly insight summary (cached per week)
export async function GET() {
  try {
    // Calculate the current week key (ISO week number)
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000)
    const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7)
    const weekKey = `weekly_insight_${now.getFullYear()}_W${weekNumber}`

    // Check cache
    const cached = await db.settings.findUnique({ where: { key: weekKey } })
    if (cached) {
      try {
        const parsed = JSON.parse(cached.value)
        return NextResponse.json({ ...parsed, cached: true })
      } catch {
        // If cache is corrupt, regenerate
      }
    }

    // Calculate date ranges
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoStr = weekAgo.toISOString().split('T')[0]
    const todayStr = now.toISOString().split('T')[0]

    // Fetch data from the past week
    const [checkIns, moodLogs, financeEntries, memories] = await Promise.all([
      db.checkIn.findMany({
        where: { date: { gte: weekAgoStr } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      db.quickLog.findMany({
        where: { date: { gte: weekAgoStr } },
        orderBy: { date: 'desc' },
      }),
      db.financeEntry.findMany({
        where: { date: { gte: weekAgoStr } },
        orderBy: { date: 'desc' },
      }),
      db.memory.findMany({
        where: { date: { gte: weekAgoStr } },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
    ])

    // Build context for AI
    const parts: string[] = []
    parts.push(`WEEKLY DATA (${weekAgoStr} to ${todayStr}):\n`)

    if (checkIns.length > 0) {
      parts.push('--- CHECK-INS ---')
      for (const ci of checkIns) {
        parts.push(`[${ci.type}] ${ci.date}: ${ci.data.substring(0, 200)}`)
      }
    }

    if (moodLogs.length > 0) {
      parts.push('--- MOOD LOGS ---')
      const avgMood = Math.round(moodLogs.reduce((s, l) => s + l.mood, 0) / moodLogs.length * 10) / 10
      const avgEnergy = Math.round(moodLogs.reduce((s, l) => s + l.energy, 0) / moodLogs.length * 10) / 10
      const avgFocus = Math.round(moodLogs.reduce((s, l) => s + l.focus, 0) / moodLogs.length * 10) / 10
      parts.push(`${moodLogs.length} logs. Avg mood=${avgMood}, energy=${avgEnergy}, focus=${avgFocus}`)
      for (const log of moodLogs.slice(0, 7)) {
        parts.push(`  ${log.date} ${log.time}: mood=${log.mood} energy=${log.energy} focus=${log.focus}${log.note ? ` "${log.note}"` : ''}`)
      }
    }

    if (financeEntries.length > 0) {
      const received = financeEntries.filter(f => f.type === 'received').reduce((s, f) => s + f.amount, 0)
      const spent = financeEntries.filter(f => f.type === 'spent').reduce((s, f) => s + f.amount, 0)
      parts.push('--- FINANCES ---')
      parts.push(`Received: ${received} | Spent: ${spent} | Net: ${received - spent}`)
      const categories: Record<string, number> = {}
      for (const e of financeEntries.filter(f => f.type === 'spent')) {
        categories[e.category] = (categories[e.category] || 0) + e.amount
      }
      if (Object.keys(categories).length > 0) {
        parts.push(`Top spending: ${Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}(${v})`).join(', ')}`)
      }
    }

    if (memories.length > 0) {
      parts.push('--- PATTERNS & MEMORIES ---')
      for (const m of memories) {
        parts.push(`[${m.type}] ${m.area}: ${m.content}`)
      }
    }

    if (parts.length <= 1) {
      return NextResponse.json({
        insight: 'Not enough data this week to generate an insight. Keep checking in and logging your mood!',
        dataPoints: 0,
        cached: false,
      })
    }

    // Call AI
    const zai = await getZAI()
    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are MyOS, generating a concise weekly insight summary.

Based on the data provided, write a 3-5 sentence weekly insight that covers:
1. Overall theme of the week
2. Key wins or progress
3. Areas of concern or drift
4. One actionable recommendation for next week

Be warm but direct. Reference specific data when available. Keep it under 150 words.
Return ONLY the insight text, no JSON, no markdown headers.`,
        },
        {
          role: 'user',
          content: parts.join('\n'),
        },
      ],
      stream: false,
    })

    const insight =
      response?.choices?.[0]?.message?.content ||
      response?.choices?.[0]?.content ||
      'Unable to generate insight this week.'

    const result = {
      insight,
      dataPoints: checkIns.length + moodLogs.length + financeEntries.length + memories.length,
      weekKey,
      generatedAt: now.toISOString(),
      cached: false,
    }

    // Cache in settings
    await db.settings.upsert({
      where: { key: weekKey },
      update: { value: JSON.stringify(result) },
      create: { key: weekKey, value: JSON.stringify(result) },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Weekly insight error:', error)
    return NextResponse.json(
      { error: 'Failed to generate weekly insight', insight: 'Could not generate insight this week.' },
      { status: 500 }
    )
  }
}
