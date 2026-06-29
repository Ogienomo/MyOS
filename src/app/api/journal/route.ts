import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { JournalCreateSchema, VALID_AREAS, VALID_MOODS } from '@/lib/validation'
import { getUserId } from '@/lib/userid'

// GET /api/journal?area=faith&from=2026-01-01&to=2026-03-01
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const area = searchParams.get('area')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const userId = getUserId(request)

    const where: Record<string, unknown> = { userId }

    if (area) {
      if (!VALID_AREAS.includes(area)) {
        return NextResponse.json(
          { error: `Invalid area. Must be one of: ${VALID_AREAS.join(', ')}` },
          { status: 400 }
        )
      }
      where.area = area
    }

    if (from || to) {
      const dateFilter: Record<string, string> = {}
      if (from) dateFilter.gte = from
      if (to) dateFilter.lte = to
      where.date = dateFilter
    }

    const [entries, total] = await Promise.all([
      db.journalEntry.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.journalEntry.count({ where }),
    ])

    return NextResponse.json({ entries, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('Journal GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch journal entries' }, { status: 500 })
  }
}

// POST /api/journal - Create a journal entry
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json()
    const parsed = JournalCreateSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { area, title, content, mood, tags, date } = parsed.data
    const userId = getUserId(request)

    const entry = await db.journalEntry.create({
      data: {
        userId,
        area,
        title: title || null,
        content,
        mood: mood || null,
        tags: tags || null,
        date,
      },
    })

    return NextResponse.json({ entry }, { status: 201 })
  } catch (error) {
    console.error('Journal POST error:', error)
    return NextResponse.json({ error: 'Failed to create journal entry' }, { status: 500 })
  }
}

// PATCH /api/journal - Update a journal entry by id
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, area, title, content, mood, tags, date } = body

    if (!id) {
      return NextResponse.json({ error: 'Entry id is required' }, { status: 400 })
    }

    const userId = getUserId(request)
    const existing = await db.journalEntry.findFirst({ where: { id, userId } })
    if (!existing) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 })
    }

    if (area && !VALID_AREAS.includes(area)) {
      return NextResponse.json(
        { error: `Invalid area. Must be one of: ${VALID_AREAS.join(', ')}` },
        { status: 400 }
      )
    }

    if (mood && !VALID_MOODS.includes(mood)) {
      return NextResponse.json(
        { error: `Invalid mood. Must be one of: ${VALID_MOODS.join(', ')}` },
        { status: 400 }
      )
    }

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Date must be in YYYY-MM-DD format' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (area !== undefined) updateData.area = area
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (mood !== undefined) updateData.mood = mood
    if (tags !== undefined) updateData.tags = tags
    if (date !== undefined) updateData.date = date

    const entry = await db.journalEntry.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ entry })
  } catch (error) {
    console.error('Journal PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update journal entry' }, { status: 500 })
  }
}

// DELETE /api/journal?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Entry id is required' }, { status: 400 })
    }

    const userId = getUserId(request)
    const existing = await db.journalEntry.findFirst({ where: { id, userId } })
    if (!existing) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 })
    }

    await db.journalEntry.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Journal entry deleted' })
  } catch (error) {
    console.error('Journal DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete journal entry' }, { status: 500 })
  }
}
