import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { callZAIWithRetry, MYOS_SYSTEM_PROMPT, formatTodaysDate } from '@/lib/ai'
import { getTodayInTimezone, formatDateInTimezone } from '@/lib/utils'
import { getUserId } from '@/lib/userid'

// Fire-and-forget streak recalculation after check-in
async function recalcStreaksAfterCheckIn(checkInType: string, userId: string) {
  try {
    const today = getTodayInTimezone()
    const typesToCalc = ['overall']
    if (checkInType === 'morning' || checkInType === 'evening') typesToCalc.push(checkInType)
    typesToCalc.push('mood') // any activity counts for mood

    for (const type of typesToCalc) {
      if (type === 'mood') {
        const quickLogs = await db.quickLog.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 60 })
        if (quickLogs.length === 0) {
          await db.streak.upsert({ where: { userId_type: { userId, type: 'mood' } }, update: { currentStreak: 0, longestStreak: 0, lastDate: null }, create: { userId, type: 'mood', currentStreak: 0, longestStreak: 0, lastDate: null } })
          continue
        }
        const logDates = new Set(quickLogs.map(l => l.date))
        let currentStreak = 0
        const d = new Date()
        if (!logDates.has(today)) d.setDate(d.getDate() - 1)
        let cd = formatDateInTimezone(d)
        while (logDates.has(cd)) { currentStreak++; d.setDate(d.getDate() - 1); cd = formatDateInTimezone(d) }
        const sorted = [...logDates].sort().reverse()
        let longest = currentStreak, temp = 1
        for (let i = 1; i < sorted.length; i++) {
          const diff = Math.round((new Date(sorted[i-1]).getTime() - new Date(sorted[i]).getTime()) / 86400000)
          if (diff === 1) { temp++; longest = Math.max(longest, temp) } else temp = 1
        }
        await db.streak.upsert({ where: { userId_type: { userId, type: 'mood' } }, update: { currentStreak, longestStreak: Math.max(longest, currentStreak), lastDate: quickLogs[0]?.date || null }, create: { userId, type: 'mood', currentStreak, longestStreak: Math.max(longest, currentStreak), lastDate: quickLogs[0]?.date || null } })
      } else if (type === 'morning' || type === 'evening') {
        const checkIns = await db.checkIn.findMany({ where: { userId, type }, orderBy: { date: 'desc' }, take: 60 })
        if (checkIns.length === 0) {
          await db.streak.upsert({ where: { userId_type: { userId, type } }, update: { currentStreak: 0, longestStreak: 0, lastDate: null }, create: { userId, type, currentStreak: 0, longestStreak: 0, lastDate: null } })
          continue
        }
        const dates = new Set(checkIns.map(ci => ci.date))
        let currentStreak = 0
        const d = new Date()
        if (!dates.has(today)) d.setDate(d.getDate() - 1)
        let cd = formatDateInTimezone(d)
        while (dates.has(cd)) { currentStreak++; d.setDate(d.getDate() - 1); cd = formatDateInTimezone(d) }
        const sorted = [...dates].sort().reverse()
        let longest = currentStreak, temp = 1
        for (let i = 1; i < sorted.length; i++) {
          const diff = Math.round((new Date(sorted[i-1]).getTime() - new Date(sorted[i]).getTime()) / 86400000)
          if (diff === 1) { temp++; longest = Math.max(longest, temp) } else temp = 1
        }
        await db.streak.upsert({ where: { userId_type: { userId, type } }, update: { currentStreak, longestStreak: Math.max(longest, currentStreak), lastDate: checkIns[0]?.date || null }, create: { userId, type, currentStreak, longestStreak: Math.max(longest, currentStreak), lastDate: checkIns[0]?.date || null } })
      } else if (type === 'overall') {
        const [allCheckIns, quickLogs] = await Promise.all([
          db.checkIn.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 60 }),
          db.quickLog.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 60 }),
        ])
        const allDates = new Set([...allCheckIns.map(ci => ci.date), ...quickLogs.map(l => l.date)])
        if (allDates.size === 0) {
          await db.streak.upsert({ where: { userId_type: { userId, type: 'overall' } }, update: { currentStreak: 0, longestStreak: 0, lastDate: null }, create: { userId, type: 'overall', currentStreak: 0, longestStreak: 0, lastDate: null } })
          continue
        }
        let currentStreak = 0
        const d = new Date()
        if (!allDates.has(today)) d.setDate(d.getDate() - 1)
        let cd = formatDateInTimezone(d)
        while (allDates.has(cd)) { currentStreak++; d.setDate(d.getDate() - 1); cd = formatDateInTimezone(d) }
        const sorted = [...allDates].sort().reverse()
        let longest = currentStreak, temp = 1
        for (let i = 1; i < sorted.length; i++) {
          const diff = Math.round((new Date(sorted[i-1]).getTime() - new Date(sorted[i]).getTime()) / 86400000)
          if (diff === 1) { temp++; longest = Math.max(longest, temp) } else temp = 1
        }
        await db.streak.upsert({ where: { userId_type: { userId, type: 'overall' } }, update: { currentStreak, longestStreak: Math.max(longest, currentStreak), lastDate: sorted[0] || null }, create: { userId, type: 'overall', currentStreak, longestStreak: Math.max(longest, currentStreak), lastDate: sorted[0] || null } })
      }
    }
  } catch (err) {
    console.error('Streak recalc error after check-in:', err)
  }
}

// GET /api/checkin?date=YYYY-MM-DD&type=morning
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const type = searchParams.get('type')
    const userId = getUserId(request)

    const where: Record<string, string> = { userId }
    if (date) where.date = date
    if (type) where.type = type

    const checkIns = await db.checkIn.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: date ? 50 : 10,
    })

    // Parse JSON data strings back to objects
    const parsed = checkIns.map((ci) => ({
      ...ci,
      data: JSON.parse(ci.data),
      aiResponse: ci.aiResponse ? JSON.parse(ci.aiResponse) : null,
    }))

    return NextResponse.json({ checkIns: parsed })
  } catch (error) {
    console.error('Check-in GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch check-ins' }, { status: 500 })
  }
}

// POST /api/checkin
export async function POST(request: NextRequest) {
  try {
    const { type, date, data } = await request.json() as { type: string; date: string; data: Record<string, unknown> }

    if (!type || !date || !data) {
      return NextResponse.json(
        { error: 'type, date, and data are required' },
        { status: 400 }
      )
    }

    const validTypes = ['morning', 'midday', 'evening', 'friday', 'sunday']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid check-in type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const userId = getUserId(request)

    // Server-side strict mode enforcement for check-in POST
    if (['morning', 'evening'].includes(type)) {
      try {
        const settingsRecord = await db.settings.findUnique({ where: { userId_key: { userId, key: 'user_settings' } } })
        if (settingsRecord) {
          const settings = JSON.parse(settingsRecord.value)
          const checkInWindows = settings.checkInWindows || {}
          if (checkInWindows.strictMode) {
            const now = new Date()
            const currentMinutes = now.getHours() * 60 + now.getMinutes()

            if (type === 'morning' && checkInWindows.morningEnabled) {
              const [h, m] = (checkInWindows.morningTime || '05:00').split(':').map(Number)
              const targetMinutes = h * 60 + m
              const windowMinutes = checkInWindows.windowMinutes || 60
              const windowMin = Math.max(0, targetMinutes - windowMinutes)
              const windowMax = targetMinutes + windowMinutes

              if (!(currentMinutes >= windowMin && currentMinutes <= windowMax)) {
                const nextH = Math.floor(windowMin / 60) % 24
                const nextM = windowMin % 60
                const nextTime = `${nextH.toString().padStart(2, '0')}:${nextM.toString().padStart(2, '0')}`
                return NextResponse.json(
                  { error: 'Check-in window closed', message: `Strict mode is ON. Morning check-in window opens at ${nextTime}.` },
                  { status: 403 }
                )
              }
            }

            if (type === 'evening' && checkInWindows.eveningEnabled) {
              const [h, m] = (checkInWindows.eveningTime || '20:30').split(':').map(Number)
              const targetMinutes = h * 60 + m
              const windowMinutes = checkInWindows.windowMinutes || 60
              const windowMin = Math.max(0, targetMinutes - windowMinutes)
              const windowMax = targetMinutes + windowMinutes

              if (!(currentMinutes >= windowMin && currentMinutes <= windowMax)) {
                const nextH = Math.floor(windowMin / 60) % 24
                const nextM = windowMin % 60
                const nextTime = `${nextH.toString().padStart(2, '0')}:${nextM.toString().padStart(2, '0')}`
                return NextResponse.json(
                  { error: 'Check-in window closed', message: `Strict mode is ON. Evening check-in window opens at ${nextTime}.` },
                  { status: 403 }
                )
              }
            }
          }
        }
      } catch (settingsError) {
        console.error('Failed to check strict mode settings in checkin POST:', settingsError)
      }
    }

    // Create the check-in
    const checkIn = await db.checkIn.create({
      data: {
        userId,
        type,
        date,
        data: JSON.stringify(data),
      },
    })

    // Build context for AI response — gather richer data in parallel
    const today = formatTodaysDate()
    const [recentScores, activeGoals, activeAlerts, recentMoodLogs, recentFinances, recentMemories] = await Promise.all([
      db.lifeAreaScore.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 3 }),
      db.goal.findMany({ where: { userId, status: 'In Progress' }, include: { tasks: true }, take: 5 }),
      db.driftAlert.findMany({ where: { userId, resolved: false }, orderBy: { createdAt: 'desc' }, take: 3 }),
      db.quickLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 3 }),
      db.financeEntry.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 3 }),
      db.memory.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 5 }),
    ])

    const contextParts: string[] = []
    contextParts.push(`Current date: ${today}`)
    contextParts.push(`Check-in type: ${type}`)
    contextParts.push(`Check-in data: ${JSON.stringify(data)}`)

    if (recentScores.length > 0) {
      contextParts.push('Recent scores:')
      for (const s of recentScores) {
        contextParts.push(
          `  ${s.date}: Faith=${s.faith} Health=${s.health} Career=${s.career} Business=${s.havilah} Finances=${s.finances} Relationships=${s.relationships} PersonalGrowth=${s.personalGrowth} Overall=${s.overall}`
        )
      }
    }

    if (activeGoals.length > 0) {
      contextParts.push('Active goals:')
      for (const g of activeGoals) {
        const done = g.tasks.filter((t) => t.status === 'Completed').length
        contextParts.push(`  [${g.area}] ${g.title} (${done}/${g.tasks.length} tasks)`)
      }
    }

    if (activeAlerts.length > 0) {
      contextParts.push('Active drift alerts:')
      for (const a of activeAlerts) {
        contextParts.push(`  [${a.severity}] ${a.area}: ${a.message}`)
      }
    }

    if (recentMoodLogs.length > 0) {
      contextParts.push('Recent mood:')
      for (const l of recentMoodLogs) {
        contextParts.push(`  ${l.date} ${l.time}: mood=${l.mood} energy=${l.energy} focus=${l.focus}${l.note ? ` "${l.note}"` : ''}`)
      }
    }

    if (recentFinances.length > 0) {
      contextParts.push('Recent finances:')
      for (const f of recentFinances) {
        contextParts.push(`  ${f.date}: ${f.type} ₦${f.amount} (${f.category})`)
      }
    }

    if (recentMemories.length > 0) {
      contextParts.push('Recent memories:')
      for (const m of recentMemories) {
        contextParts.push(`  [${m.type}] ${m.area}: ${m.content}`)
      }
    }

    // Generate AI response with retry
    let aiResponseText = ''
    let aiSucceeded = false
    try {
      const aiResponse = await callZAIWithRetry([
        { role: 'system', content: MYOS_SYSTEM_PROMPT },
        {
          role: 'system',
          content: `You are responding to Praise's ${type} check-in. Here is the context:\n${contextParts.join('\n')}`,
        },
        {
          role: 'user',
          content: `Here is my ${type} check-in for ${date}: ${JSON.stringify(data)}`,
        },
      ], 2)

      if (aiResponse) {
        aiResponseText = aiResponse
        aiSucceeded = true
      }
    } catch (aiError) {
      console.error('AI response generation failed, using fallback:', aiError)
    }

    // Intelligent context-aware fallback if AI failed
    if (!aiSucceeded) {
      const typeLabels: Record<string, string> = {
        morning: 'Morning Alignment',
        midday: 'Midday Correction',
        evening: 'Evening Review',
        friday: 'Friday Strategic Review',
        sunday: 'Sunday Planning',
      }
      const label = typeLabels[type] || type

      const parts: string[] = []
      parts.push(`## ${label} Recorded`)
      parts.push('')
      parts.push(`Your ${label} has been saved, . Here's what I'm seeing based on your data:`)
      parts.push('')

      if (recentScores.length > 0) {
        const s = recentScores[0]
        parts.push('## Your Current Standing')
        parts.push('')
        parts.push(`Faith: **${s.faith}/10** | Health: **${s.health}/10** | Career: **${s.career}/10** | Business: **${s.havilah}/10** | Finances: **${s.finances}/10** | Relationships: **${s.relationships}/10** | Personal Growth: **${s.personalGrowth}/10**`)
        parts.push(`Overall: **${s.overall}/10**`)
        parts.push('')
      }

      if (activeGoals.length > 0) {
        parts.push('## Goals in Progress')
        parts.push('')
        for (const g of activeGoals.slice(0, 3)) {
          const done = g.tasks.filter(t => t.status === 'Completed').length
          parts.push(`- **[${g.area}]** ${g.title} — ${done}/${g.tasks.length} tasks done`)
        }
        parts.push('')
      }

      if (activeAlerts.length > 0) {
        parts.push('## Drift Alerts')
        parts.push('')
        for (const a of activeAlerts) {
          parts.push(`- ${a.message} (${a.severity})`)
        }
        parts.push('')
      }

      // Type-specific coaching
      if (type === 'morning') {
        parts.push('> **Before you start today:** What is the ONE outcome that would make today a win? Protect that time block.')
      } else if (type === 'evening') {
        parts.push('> **Tonight:** What is one thing you did today that your future self will thank you for? Name it.')
      } else if (type === 'midday') {
        parts.push('> **Right now:** Are you working on what matters most, or just what feels most urgent? Adjust if needed.')
      } else if (type === 'friday') {
        parts.push('> **Weekly truth:** Did this week move you closer to your vision, or did you just stay busy? Be honest.')
      } else if (type === 'sunday') {
        parts.push('> **Planning move:** Block your deep work for next week NOW before the noise takes over.')
      }

      aiResponseText = parts.join('\n')
    }

    // Store AI response in check-in
    const updatedCheckIn = await db.checkIn.update({
      where: { id: checkIn.id },
      data: { aiResponse: JSON.stringify({ text: aiResponseText }) },
    })

    // Also store as chat messages
    await db.chatMessage.create({
      data: {
        userId,
        role: 'user',
        content: `[${type} check-in] ${JSON.stringify(data)}`,
        checkInType: type,
      },
    })
    const assistantMsg = await db.chatMessage.create({
      data: {
        userId,
        role: 'assistant',
        content: aiResponseText,
        checkInType: type,
      },
    })

    // Fire-and-forget streak recalculation after check-in
    recalcStreaksAfterCheckIn(type, userId).catch(() => {})

    return NextResponse.json({
      checkIn: {
        ...updatedCheckIn,
        data: JSON.parse(updatedCheckIn.data),
        aiResponse: JSON.parse(updatedCheckIn.aiResponse || '{}'),
      },
      aiResponse: aiResponseText,
      assistantMessageId: assistantMsg.id,
    })
  } catch (error) {
    console.error('Check-in POST error:', error)
    return NextResponse.json({ error: 'Failed to create check-in' }, { status: 500 })
  }
}
