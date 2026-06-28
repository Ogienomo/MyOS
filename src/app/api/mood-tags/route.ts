import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/mood-tags — List all custom mood tags (pinned first)
export async function GET() {
  try {
    const tags = await db.customMoodTag.findMany({
      orderBy: [{ pinned: 'desc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Mood tags GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch mood tags' }, { status: 500 })
  }
}

// POST /api/mood-tags — Create a new tag
export async function POST(request: NextRequest) {
  try {
    const { name, emoji, color, pinned } = await request.json() as { name: string; emoji?: string; color?: string; pinned?: boolean }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const tag = await db.customMoodTag.create({
      data: {
        name: name.trim(),
        emoji: emoji || null,
        color: color || null,
        pinned: pinned === true,
      },
    })

    return NextResponse.json({ tag }, { status: 201 })
  } catch (error) {
    console.error('Mood tags POST error:', error)
    return NextResponse.json({ error: 'Failed to create mood tag' }, { status: 500 })
  }
}

// PUT /api/mood-tags — Update a tag
export async function PUT(request: NextRequest) {
  try {
    const { id, name, emoji, color, pinned } = await request.json() as { id: string; name?: string; emoji?: string; color?: string; pinned?: boolean }

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const existing = await db.customMoodTag.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (emoji !== undefined) updateData.emoji = emoji || null
    if (color !== undefined) updateData.color = color || null
    if (pinned !== undefined) updateData.pinned = pinned

    const tag = await db.customMoodTag.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ tag })
  } catch (error) {
    console.error('Mood tags PUT error:', error)
    return NextResponse.json({ error: 'Failed to update mood tag' }, { status: 500 })
  }
}

// DELETE /api/mood-tags?id=xxx — Delete a tag
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 })
    }

    const existing = await db.customMoodTag.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    await db.customMoodTag.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Mood tags DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete mood tag' }, { status: 500 })
  }
}
