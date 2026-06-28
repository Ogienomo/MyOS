import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface Nudge {
  message: string
  area: string
  priority: 'low' | 'medium' | 'high'
  action: string
  actionTab: string
}

export async function GET() {
  try {
    const nudges: Nudge[] = []

    // Get recent scores (last 14 days)
    const recentScores = await db.lifeAreaScore.findMany({
      orderBy: { date: 'desc' },
      take: 14,
    })

    // 1. Score dropped 2+ points this week
    if (recentScores.length >= 7) {
      const thisWeek = recentScores.slice(0, 7)
      const lastWeek = recentScores.slice(7, 14)
      const areas = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth'] as const

      for (const area of areas) {
        const thisWeekAvg = thisWeek.reduce((sum, s) => sum + (s[area] as number), 0) / thisWeek.length
        const lastWeekAvg = lastWeek.reduce((sum, s) => sum + (s[area] as number), 0) / lastWeek.length
        const drop = lastWeekAvg - thisWeekAvg

        if (drop >= 2) {
          nudges.push({
            message: `Your ${area} score dropped ${drop.toFixed(1)} points this week. Consider talking to your AI Coach about it.`,
            area,
            priority: drop >= 3 ? 'high' : 'medium',
            action: 'Talk to AI Coach',
            actionTab: 'chat',
          })
        }
      }
    }

    // 2. Career score is lowest → encouragement
    if (recentScores.length > 0) {
      const latestScore = recentScores[0]
      const areas = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth'] as const
      let lowestArea = areas[0]
      let lowestScore = latestScore[areas[0]] as number

      for (const area of areas) {
        const score = latestScore[area] as number
        if (score < lowestScore) {
          lowestScore = score
          lowestArea = area
        }
      }

      if (lowestScore <= 4) {
        nudges.push({
          message: `Your ${lowestArea} score is at ${lowestScore}/10 — the lowest area right now. Small consistent actions can turn this around.`,
          area: lowestArea,
          priority: 'medium',
          action: `Review ${lowestArea}`,
          actionTab: lowestArea,
        })
      }
    }

    // 3. Spending is up 30%+ this week
    const now = new Date()
    const thisWeekStart = new Date(now)
    thisWeekStart.setDate(now.getDate() - now.getDay())
    const lastWeekStart = new Date(thisWeekStart)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)

    const thisWeekSpent = await db.financeEntry.findMany({
      where: {
        type: 'spent',
        date: { gte: thisWeekStart.toISOString().split('T')[0] },
      },
    })
    const lastWeekSpent = await db.financeEntry.findMany({
      where: {
        type: 'spent',
        date: {
          gte: lastWeekStart.toISOString().split('T')[0],
          lt: thisWeekStart.toISOString().split('T')[0],
        },
      },
    })

    const thisWeekTotal = thisWeekSpent.reduce((sum, e) => sum + e.amount, 0)
    const lastWeekTotal = lastWeekSpent.reduce((sum, e) => sum + e.amount, 0)

    if (lastWeekTotal > 0 && thisWeekTotal > lastWeekTotal * 1.3) {
      const pctIncrease = Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100)
      nudges.push({
        message: `Spending is up ${pctIncrease}% compared to last week. Review your expenses to stay aligned.`,
        area: 'finances',
        priority: pctIncrease >= 50 ? 'high' : 'medium',
        action: 'Review Finances',
        actionTab: 'finances',
      })
    }

    // 4. Haven't checked in today
    const today = now.toISOString().split('T')[0]
    const todayCheckIns = await db.checkIn.findMany({
      where: { date: today },
    })

    if (todayCheckIns.length === 0 && now.getHours() >= 10) {
      nudges.push({
        message: "You haven't checked in today yet. Staying consistent with check-ins is key to alignment.",
        area: 'general',
        priority: now.getHours() >= 14 ? 'high' : 'medium',
        action: 'Start Check-in',
        actionTab: 'chat',
      })
    }

    // 5. Haven't logged mood today
    const todayQuickLog = await db.quickLog.findFirst({
      where: { date: today },
    })

    if (!todayQuickLog && now.getHours() >= 14) {
      nudges.push({
        message: "You haven't logged your mood today. A quick check-in helps track your patterns.",
        area: 'general',
        priority: 'low',
        action: 'Log Mood',
        actionTab: 'moodLog',
      })
    }

    // 6. Habit check: look for health habits not completed in 3 days
    const threeDaysAgo = new Date(now)
    threeDaysAgo.setDate(now.getDate() - 3)
    const activeHealthHabits = await db.habit.findMany({
      where: {
        area: 'health',
        active: true,
      },
    })

    for (const habit of activeHealthHabits) {
      const recentLogs = await db.habitLog.findMany({
        where: {
          habitId: habit.id,
          date: { gte: threeDaysAgo.toISOString().split('T')[0] },
        },
      })
      if (recentLogs.length === 0) {
        nudges.push({
          message: `You haven't logged "${habit.title}" in 3+ days. Consistency builds momentum.`,
          area: 'health',
          priority: 'medium',
          action: 'Log Habits',
          actionTab: 'habits',
        })
        break // Only nudge about one habit
      }
    }

    // Sort by priority
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    nudges.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])

    return NextResponse.json({ nudges: nudges.slice(0, 5) })
  } catch (error) {
    console.error('AI nudge error:', error)
    return NextResponse.json({ nudges: [] })
  }
}
