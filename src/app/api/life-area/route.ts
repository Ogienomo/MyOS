import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const VALID_AREAS = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth']

// GET /api/life-area?area=faith
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const area = searchParams.get('area')

    if (area && !VALID_AREAS.includes(area)) {
      return NextResponse.json(
        { error: `Invalid area. Must be one of: ${VALID_AREAS.join(', ')}` },
        { status: 400 }
      )
    }

    const where: Record<string, string> = {}
    if (area) where.area = area

    const records = await db.lifeAreaProgress.findMany({
      where,
      orderBy: { area: 'asc' },
    })

    return NextResponse.json({ records })
  } catch (error) {
    console.error('LifeArea GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch life area progress' }, { status: 500 })
  }
}

// POST /api/life-area - Create or update a life area progress record (upsert by area)
export async function POST(request: NextRequest) {
  try {
    const { area, currentStatus, idealVision, keyActions, blockers, motivation } = await request.json() as { area: string; currentStatus?: string; idealVision?: string; keyActions?: string; blockers?: string; motivation?: string }

    if (!area) {
      return NextResponse.json({ error: 'area is required' }, { status: 400 })
    }

    if (!VALID_AREAS.includes(area)) {
      return NextResponse.json(
        { error: `Invalid area. Must be one of: ${VALID_AREAS.join(', ')}` },
        { status: 400 }
      )
    }

    // Upsert by area (since area is unique)
    const record = await db.lifeAreaProgress.upsert({
      where: { area },
      update: {
        ...(currentStatus !== undefined && { currentStatus }),
        ...(idealVision !== undefined && { idealVision }),
        ...(keyActions !== undefined && { keyActions }),
        ...(blockers !== undefined && { blockers }),
        ...(motivation !== undefined && { motivation }),
      },
      create: {
        area,
        currentStatus: currentStatus || null,
        idealVision: idealVision || null,
        keyActions: keyActions || null,
        blockers: blockers || null,
        motivation: motivation || null,
      },
    })

    return NextResponse.json({ record })
  } catch (error) {
    console.error('LifeArea POST error:', error)
    return NextResponse.json({ error: 'Failed to create/update life area progress' }, { status: 500 })
  }
}
