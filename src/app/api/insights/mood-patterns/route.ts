import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/insights/mood-patterns — Mood pattern analysis over the past 2 weeks
export async function GET() {
  try {
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0]

    const logs = await db.quickLog.findMany({
      where: { date: { gte: twoWeeksAgoStr } },
      orderBy: { date: 'asc' },
    })

    if (logs.length === 0) {
      return NextResponse.json({
        hasData: false,
        message: 'No mood logs in the past 2 weeks. Start logging to see patterns!',
      })
    }

    // Calculate overall averages
    const avgMood = Math.round(logs.reduce((s, l) => s + l.mood, 0) / logs.length * 10) / 10
    const avgEnergy = Math.round(logs.reduce((s, l) => s + l.energy, 0) / logs.length * 10) / 10
    const avgFocus = Math.round(logs.reduce((s, l) => s + l.focus, 0) / logs.length * 10) / 10

    // Daily breakdown
    const byDate: Record<string, { mood: number[]; energy: number[]; focus: number[]; date: string }> = {}
    for (const log of logs) {
      if (!byDate[log.date]) {
        byDate[log.date] = { mood: [], energy: [], focus: [], date: log.date }
      }
      byDate[log.date].mood.push(log.mood)
      byDate[log.date].energy.push(log.energy)
      byDate[log.date].focus.push(log.focus)
    }

    const dailyBreakdown = Object.values(byDate).map(d => ({
      date: d.date,
      mood: Math.round(d.mood.reduce((a, b) => a + b, 0) / d.mood.length * 10) / 10,
      energy: Math.round(d.energy.reduce((a, b) => a + b, 0) / d.energy.length * 10) / 10,
      focus: Math.round(d.focus.reduce((a, b) => a + b, 0) / d.focus.length * 10) / 10,
      count: d.mood.length,
    }))

    // Mood trend (improving/declining/stable)
    let moodTrend = 'stable'
    if (dailyBreakdown.length >= 3) {
      const firstHalf = dailyBreakdown.slice(0, Math.floor(dailyBreakdown.length / 2))
      const secondHalf = dailyBreakdown.slice(Math.floor(dailyBreakdown.length / 2))
      const firstAvg = firstHalf.reduce((s, d) => s + d.mood, 0) / firstHalf.length
      const secondAvg = secondHalf.reduce((s, d) => s + d.mood, 0) / secondHalf.length
      if (secondAvg > firstAvg + 0.5) moodTrend = 'improving'
      else if (secondAvg < firstAvg - 0.5) moodTrend = 'declining'
    }

    // Energy pattern — which day of week has highest/lowest energy
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const byDayOfWeek: Record<string, { energy: number[]; mood: number[] }> = {}
    for (const log of logs) {
      const dayOfWeek = dayNames[new Date(log.date).getDay()]
      if (!byDayOfWeek[dayOfWeek]) byDayOfWeek[dayOfWeek] = { energy: [], mood: [] }
      byDayOfWeek[dayOfWeek].energy.push(log.energy)
      byDayOfWeek[dayOfWeek].mood.push(log.mood)
    }

    let highestEnergyDay = ''
    let lowestEnergyDay = ''
    let highestEnergyAvg = 0
    let lowestEnergyAvg = 11

    for (const [day, vals] of Object.entries(byDayOfWeek)) {
      const avg = vals.energy.reduce((a, b) => a + b, 0) / vals.energy.length
      if (avg > highestEnergyAvg) {
        highestEnergyAvg = avg
        highestEnergyDay = day
      }
      if (avg < lowestEnergyAvg) {
        lowestEnergyAvg = avg
        lowestEnergyDay = day
      }
    }

    // Focus-mood correlation
    let focusMoodCorrelation = 'none'
    if (logs.length >= 5) {
      const meanMood = avgMood
      const meanFocus = avgFocus
      let numSum = 0
      let denSumMood = 0
      let denSumFocus = 0
      for (const log of logs) {
        const moodDiff = log.mood - meanMood
        const focusDiff = log.focus - meanFocus
        numSum += moodDiff * focusDiff
        denSumMood += moodDiff * moodDiff
        denSumFocus += focusDiff * focusDiff
      }
      const denominator = Math.sqrt(denSumMood * denSumFocus)
      if (denominator > 0) {
        const correlation = numSum / denominator
        if (correlation > 0.4) focusMoodCorrelation = 'positive'
        else if (correlation < -0.4) focusMoodCorrelation = 'negative'
        else focusMoodCorrelation = 'weak'
      }
    }

    // Best and worst day
    let bestDay = dailyBreakdown[0]
    let worstDay = dailyBreakdown[0]
    for (const d of dailyBreakdown) {
      const composite = d.mood * 0.5 + d.energy * 0.3 + d.focus * 0.2
      const bestComposite = bestDay.mood * 0.5 + bestDay.energy * 0.3 + bestDay.focus * 0.2
      const worstComposite = worstDay.mood * 0.5 + worstDay.energy * 0.3 + worstDay.focus * 0.2
      if (composite > bestComposite) bestDay = d
      if (composite < worstComposite) worstDay = d
    }

    return NextResponse.json({
      hasData: true,
      period: '14 days',
      totalLogs: logs.length,
      averages: { mood: avgMood, energy: avgEnergy, focus: avgFocus },
      moodTrend,
      energyPattern: {
        highestDay: highestEnergyDay ? { day: highestEnergyDay, avgEnergy: Math.round(highestEnergyAvg * 10) / 10 } : null,
        lowestDay: lowestEnergyDay ? { day: lowestEnergyDay, avgEnergy: Math.round(lowestEnergyAvg * 10) / 10 } : null,
      },
      focusMoodCorrelation,
      bestDay: { date: bestDay.date, mood: bestDay.mood, energy: bestDay.energy, focus: bestDay.focus },
      worstDay: { date: worstDay.date, mood: worstDay.mood, energy: worstDay.energy, focus: worstDay.focus },
      dailyBreakdown,
    })
  } catch (error) {
    console.error('Mood patterns error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze mood patterns' },
      { status: 500 }
    )
  }
}
