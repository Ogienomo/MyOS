import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userid'

interface Correlation {
  area1: string
  area2: string
  coefficient: number
  direction: 'positive' | 'negative'
  insight: string
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length
  if (n < 3) return 0

  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n

  let num = 0
  let denX = 0
  let denY = 0

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }

  const den = Math.sqrt(denX * denY)
  if (den === 0) return 0
  return num / den
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request)
    // Get last 90 days of scores
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const cutoff = ninetyDaysAgo.toISOString().split('T')[0]

    const scores = await db.lifeAreaScore.findMany({
      where: { userId, date: { gte: cutoff } },
      orderBy: { date: 'asc' },
    })

    if (scores.length < 5) {
      return NextResponse.json({ correlations: [], insights: [] })
    }

    const areas = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth'] as const
    const areaLabels: Record<string, string> = {
      faith: 'Faith',
      health: 'Health',
      career: 'Career',
      havilah: 'Business',
      finances: 'Finances',
      relationships: 'Relationships',
      personalGrowth: 'Growth',
    }

    const correlations: Correlation[] = []

    // Calculate pairwise correlations
    for (let i = 0; i < areas.length; i++) {
      for (let j = i + 1; j < areas.length; j++) {
        const area1 = areas[i]
        const area2 = areas[j]

        const x = scores.map(s => s[area1] as number)
        const y = scores.map(s => s[area2] as number)

        const r = pearsonCorrelation(x, y)

        // Only include significant correlations (|r| > 0.4)
        if (Math.abs(r) >= 0.4) {
          const direction = r > 0 ? 'positive' : 'negative'
          const strength = Math.abs(r) >= 0.7 ? 'strongly' : Math.abs(r) >= 0.5 ? 'moderately' : 'weakly'

          let insight: string
          if (r > 0) {
            insight = `When your ${areaLabels[area1]} score goes up, your ${areaLabels[area2]} score tends to follow (r=${r.toFixed(2)}). They move ${strength} together.`
          } else {
            insight = `When your ${areaLabels[area1]} score goes up, your ${areaLabels[area2]} score tends to go down (r=${r.toFixed(2)}). They ${strength} oppose each other.`
          }

          correlations.push({
            area1,
            area2,
            coefficient: Math.round(r * 100) / 100,
            direction,
            insight,
          })
        }
      }
    }

    // Sort by absolute correlation (strongest first)
    correlations.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient))

    // Generate top insights
    const insights = correlations.slice(0, 3).map(c => c.insight)

    return NextResponse.json({ correlations, insights })
  } catch (error) {
    console.error('Correlations error:', error)
    return NextResponse.json({ correlations: [], insights: [] })
  }
}
