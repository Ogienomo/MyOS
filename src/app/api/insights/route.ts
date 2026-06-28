import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getZAI } from '@/lib/ai'

// GET /api/insights?type=alerts&resolved=false
// GET /api/insights?type=memories
// GET /api/insights?type=memories-count  (lightweight — returns only total)
// GET /api/insights?type=mood-trends
// GET /api/insights?type=ai-insights
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // alerts, memories, mood-trends, ai-insights, or both
    const resolvedParam = searchParams.get('resolved')
    const resolved = resolvedParam === 'true' ? true : resolvedParam === 'false' ? false : undefined

    // Lightweight count endpoint — used by chat header badge
    if (type === 'memories-count') {
      const total = await db.memory.count()
      return NextResponse.json({ total })
    }

    // Mood trends endpoint
    if (type === 'mood-trends') {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const weekAgoStr = sevenDaysAgo.toISOString().split('T')[0]

      const logs = await db.quickLog.findMany({
        where: { date: { gte: weekAgoStr } },
        orderBy: { date: 'asc' },
      })

      if (logs.length === 0) {
        return NextResponse.json({
          period: '7 days',
          averages: null,
          dailyBreakdown: [],
          trend: 'no_data',
        })
      }

      // Calculate averages
      const avgMood = Math.round(logs.reduce((s, l) => s + l.mood, 0) / logs.length * 10) / 10
      const avgEnergy = Math.round(logs.reduce((s, l) => s + l.energy, 0) / logs.length * 10) / 10
      const avgFocus = Math.round(logs.reduce((s, l) => s + l.focus, 0) / logs.length * 10) / 10

      // Daily breakdown
      const byDate: Record<string, { mood: number[]; energy: number[]; focus: number[] }> = {}
      for (const log of logs) {
        if (!byDate[log.date]) {
          byDate[log.date] = { mood: [], energy: [], focus: [] }
        }
        byDate[log.date].mood.push(log.mood)
        byDate[log.date].energy.push(log.energy)
        byDate[log.date].focus.push(log.focus)
      }

      const dailyBreakdown = Object.entries(byDate).map(([date, vals]) => ({
        date,
        mood: Math.round(vals.mood.reduce((a, b) => a + b, 0) / vals.mood.length * 10) / 10,
        energy: Math.round(vals.energy.reduce((a, b) => a + b, 0) / vals.energy.length * 10) / 10,
        focus: Math.round(vals.focus.reduce((a, b) => a + b, 0) / vals.focus.length * 10) / 10,
        count: vals.mood.length,
      }))

      // Determine trend direction
      let trend = 'stable'
      if (dailyBreakdown.length >= 2) {
        const firstHalf = dailyBreakdown.slice(0, Math.floor(dailyBreakdown.length / 2))
        const secondHalf = dailyBreakdown.slice(Math.floor(dailyBreakdown.length / 2))
        const firstAvg = firstHalf.reduce((s, d) => s + d.mood, 0) / firstHalf.length
        const secondAvg = secondHalf.reduce((s, d) => s + d.mood, 0) / secondHalf.length
        if (secondAvg > firstAvg + 0.5) trend = 'improving'
        else if (secondAvg < firstAvg - 0.5) trend = 'declining'
      }

      return NextResponse.json({
        period: '7 days',
        averages: { mood: avgMood, energy: avgEnergy, focus: avgFocus },
        dailyBreakdown,
        trend,
        totalLogs: logs.length,
      })
    }

    // AI insights endpoint
    if (type === 'ai-insights') {
      try {
        // Gather context for AI analysis
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const weekAgoStr = sevenDaysAgo.toISOString().split('T')[0]

        const [recentLogs, recentCheckIns, recentMemories, recentChats] = await Promise.all([
          db.quickLog.findMany({
            where: { date: { gte: weekAgoStr } },
            orderBy: { date: 'desc' },
            take: 14,
          }),
          db.checkIn.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
          db.memory.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
          }),
          db.chatMessage.findMany({
            where: { role: 'user' },
            orderBy: { createdAt: 'desc' },
            take: 10,
          }),
        ])

        const contextParts: string[] = []

        if (recentLogs.length > 0) {
          contextParts.push('--- MOOD LOGS (last 7 days) ---')
          for (const log of recentLogs) {
            contextParts.push(`  ${log.date} ${log.time}: mood=${log.mood} energy=${log.energy} focus=${log.focus}${log.note ? ` note="${log.note}"` : ''}`)
          }
          const avgMood = Math.round(recentLogs.reduce((s, l) => s + l.mood, 0) / recentLogs.length * 10) / 10
          const avgEnergy = Math.round(recentLogs.reduce((s, l) => s + l.energy, 0) / recentLogs.length * 10) / 10
          const avgFocus = Math.round(recentLogs.reduce((s, l) => s + l.focus, 0) / recentLogs.length * 10) / 10
          contextParts.push(`  AVERAGES: mood=${avgMood} energy=${avgEnergy} focus=${avgFocus}`)
        }

        if (recentCheckIns.length > 0) {
          contextParts.push('--- RECENT CHECK-INS ---')
          for (const ci of recentCheckIns) {
            contextParts.push(`  [${ci.type}] ${ci.date}: ${ci.data.substring(0, 200)}`)
          }
        }

        if (recentMemories.length > 0) {
          contextParts.push('--- RECENT MEMORIES ---')
          for (const m of recentMemories) {
            contextParts.push(`  [${m.type}] ${m.area}: ${m.content}`)
          }
        }

        if (recentChats.length > 0) {
          contextParts.push('--- RECENT CHAT MESSAGES ---')
          for (const msg of recentChats) {
            contextParts.push(`  ${msg.content.substring(0, 150)}`)
          }
        }

        if (contextParts.length === 0) {
          return NextResponse.json({
            insights: 'Not enough data yet. Keep logging your mood and checking in to unlock AI insights.',
          })
        }

        const zai = await getZAI()
        const aiResponse = await zai.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `You are MyOS, analyzing data to generate actionable insights.

Based on the data provided, generate 3-5 concise, actionable insights about mood, energy, focus, and behavioral patterns.

For each insight:
- Be specific and data-driven (reference numbers when available)
- Be direct and practical
- Suggest one concrete action
- Use warm but firm tone

Format as JSON:
{
  "insights": [
    {
      "title": "Short insight title",
      "observation": "What the data shows",
      "action": "One concrete action to take",
      "priority": "high" or "medium" or "low"
    }
  ]
}

Return ONLY the JSON, no markdown or explanation.`,
            },
            {
              role: 'user',
              content: `Analyze this data and generate insights:\n\n${contextParts.join('\n')}`,
            },
          ],
          stream: false,
        })

        const content =
          aiResponse?.choices?.[0]?.message?.content ||
          aiResponse?.choices?.[0]?.content ||
          ''

        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            return NextResponse.json(parsed)
          }
        } catch {
          // Fallback to raw text
        }

        return NextResponse.json({
          insights: [
            {
              title: 'Data collected',
              observation: content.substring(0, 300),
              action: 'Review your mood patterns regularly',
              priority: 'medium',
            },
          ],
        })
      } catch (aiError) {
        console.error('AI insights generation error:', aiError)
        return NextResponse.json({
          insights: [],
          error: 'Failed to generate AI insights',
        })
      }
    }

    // Default: alerts and/or memories
    const result: {
      driftAlerts?: Awaited<ReturnType<typeof db.driftAlert.findMany>>
      memories?: Awaited<ReturnType<typeof db.memory.findMany>>
      memoriesTotal?: number
    } = {}

    // Return drift alerts if type is 'alerts' or not specified
    if (!type || type === 'alerts') {
      const alertWhere: Record<string, unknown> = {}
      if (resolved !== undefined) alertWhere.resolved = resolved

      result.driftAlerts = await db.driftAlert.findMany({
        where: alertWhere,
        orderBy: { createdAt: 'desc' },
      })
    }

    // Return memories if type is 'memories' or not specified
    if (!type || type === 'memories') {
      const [memories, total] = await Promise.all([
        db.memory.findMany({
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        db.memory.count(),
      ])
      result.memories = memories
      result.memoriesTotal = total
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Insights GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 })
  }
}

// POST /api/insights - Create a memory or drift alert
export async function POST(request: NextRequest) {
  try {
    const { type, area, content, severity, date, memoryType } = await request.json() as { type: string; area: string; content: string; severity?: string; date: string; memoryType?: string }

    if (!type || !area || !content || !date) {
      return NextResponse.json(
        { error: 'type, area, content, and date are required' },
        { status: 400 }
      )
    }

    const validAreas = [
      'faith',
      'health',
      'career',
      'havilah',
      'finances',
      'relationships',
      'personalGrowth',
    ]
    if (!validAreas.includes(area)) {
      return NextResponse.json(
        { error: `Invalid area. Must be one of: ${validAreas.join(', ')}` },
        { status: 400 }
      )
    }

    if (type === 'memory') {
      const validMemoryTypes = [
        'win',
        'distraction',
        'weakness',
        'strength',
        'correction',
        'decision',
        'pattern',
        'event',
      ]
      if (!validMemoryTypes.includes(memoryType || 'pattern')) {
        return NextResponse.json(
          { error: `Invalid memory type. Must be one of: ${validMemoryTypes.join(', ')}` },
          { status: 400 }
        )
      }

      const memory = await db.memory.create({
        data: {
          type: memoryType || 'pattern',
          area,
          content,
          date,
        },
      })

      return NextResponse.json({ memory }, { status: 201 })
    } else if (type === 'alert') {
      if (!severity || !['warning', 'critical'].includes(severity)) {
        return NextResponse.json(
          { error: 'severity must be "warning" or "critical"' },
          { status: 400 }
        )
      }

      const alert = await db.driftAlert.create({
        data: {
          area,
          severity,
          message: content,
          date,
        },
      })

      return NextResponse.json({ alert }, { status: 201 })
    } else {
      return NextResponse.json(
        { error: 'type must be "memory" or "alert"' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Insights POST error:', error)
    return NextResponse.json({ error: 'Failed to create insight' }, { status: 500 })
  }
}
