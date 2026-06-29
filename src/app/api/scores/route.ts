import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ScoreSchema, clampScore } from '@/lib/validation'
import { getUserId } from '@/lib/userid'

// GET /api/scores?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const userId = getUserId(request)

    // Default to last 7 days
    const to = toParam || new Date().toISOString().split('T')[0]
    const fromDate = fromParam
      ? new Date(fromParam)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const from = fromDate.toISOString().split('T')[0]

    const scores = await db.lifeAreaScore.findMany({
      where: {
        userId,
        date: { gte: from, lte: to },
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ scores })
  } catch (error) {
    console.error('Scores GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 })
  }
}

// POST /api/scores - Create or update scores for a date
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json()
    const parsed = ScoreSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const body = parsed.data
    const { date } = body
    const userId = getUserId(request)

    // Clamp all scores to [0,10]
    const faith = clampScore(body.faith) ?? 0
    const health = clampScore(body.health) ?? 0
    const career = clampScore(body.career) ?? 0
    const havilah = clampScore(body.havilah) ?? 0
    const finances = clampScore(body.finances) ?? 0
    const relationships = clampScore(body.relationships) ?? 0
    const personalGrowth = clampScore(body.personalGrowth) ?? 0
    const overall = clampScore(body.overall) ?? 0

    // Upsert: if score for this date exists, update it; otherwise create new
    const existingScore = await db.lifeAreaScore.findUnique({
      where: { userId_date: { userId, date } },
    })

    const scoreData = {
      faith: faith ?? 0,
      health: health ?? 0,
      career: career ?? 0,
      havilah: havilah ?? 0,
      finances: finances ?? 0,
      relationships: relationships ?? 0,
      personalGrowth: personalGrowth ?? 0,
      overall: overall ?? 0,
    }

    let score
    if (existingScore) {
      // Only update fields that are provided
      const updateData: Record<string, number> = {}
      if (faith !== undefined) updateData.faith = faith
      if (health !== undefined) updateData.health = health
      if (career !== undefined) updateData.career = career
      if (havilah !== undefined) updateData.havilah = havilah
      if (finances !== undefined) updateData.finances = finances
      if (relationships !== undefined) updateData.relationships = relationships
      if (personalGrowth !== undefined) updateData.personalGrowth = personalGrowth
      if (overall !== undefined) updateData.overall = overall

      score = await db.lifeAreaScore.update({
        where: { userId_date: { userId, date } },
        data: updateData,
      })
    } else {
      score = await db.lifeAreaScore.create({
        data: { userId, date, ...scoreData },
      })
    }

    return NextResponse.json({ score })
  } catch (error) {
    console.error('Scores POST error:', error)
    return NextResponse.json({ error: 'Failed to create/update scores' }, { status: 500 })
  }
}
