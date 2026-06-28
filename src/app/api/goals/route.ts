import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/goals?area=career
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const area = searchParams.get('area')

    const where: Record<string, string> = {}
    if (area) where.area = area

    const goals = await db.goal.findMany({
      where,
      include: {
        tasks: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json({ goals })
  } catch (error) {
    console.error('Goals GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
  }
}

// POST /api/goals - Create a new goal
export async function POST(request: NextRequest) {
  try {
    const { area, title, description, whyItMatters, successMetric, targetDate } = await request.json() as { area: string; title: string; description?: string; whyItMatters?: string; successMetric?: string; targetDate?: string }

    if (!area || !title) {
      return NextResponse.json({ error: 'Area and title are required' }, { status: 400 })
    }

    // Dedup check: don't create a goal with the same title in the same area
    const existing = await db.goal.findFirst({
      where: { area, title: { equals: title, mode: 'insensitive' } },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'A goal with this title already exists in this area', existingGoal: existing },
        { status: 409 }
      )
    }

    // Get max order for the area
    const maxOrder = await db.goal.findFirst({
      where: { area },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const goal = await db.goal.create({
      data: {
        area,
        title,
        description: description || null,
        whyItMatters: whyItMatters || null,
        successMetric: successMetric || null,
        targetDate: targetDate || null,
        status: 'Not Started',
        order: (maxOrder?.order ?? 0) + 1,
      },
      include: { tasks: true },
    })

    return NextResponse.json({ goal }, { status: 201 })
  } catch (error) {
    console.error('Goals POST error:', error)
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 })
  }
}

// PUT /api/goals - Update a goal's details
export async function PUT(request: NextRequest) {
  try {
    const { id, title, description, whyItMatters, successMetric, targetDate, status, area } = await request.json() as { id: string; title?: string; description?: string; whyItMatters?: string; successMetric?: string; targetDate?: string; status?: string; area?: string }

    if (!id) {
      return NextResponse.json({ error: 'Goal ID is required' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (title !== undefined) data.title = title
    if (description !== undefined) data.description = description
    if (whyItMatters !== undefined) data.whyItMatters = whyItMatters
    if (successMetric !== undefined) data.successMetric = successMetric
    if (targetDate !== undefined) data.targetDate = targetDate
    if (status !== undefined) data.status = status
    if (area !== undefined) data.area = area

    // Dedup check if title is being changed
    if (title) {
      const current = await db.goal.findUnique({ where: { id } })
      if (current && current.title !== title) {
        const duplicate = await db.goal.findFirst({
          where: {
            area: area || current.area,
            title: { equals: title, mode: 'insensitive' },
            id: { not: id },
          },
        })
        if (duplicate) {
          return NextResponse.json(
            { error: 'A goal with this title already exists in this area' },
            { status: 409 }
          )
        }
      }
    }

    const goal = await db.goal.update({
      where: { id },
      data,
      include: { tasks: true },
    })

    return NextResponse.json({ goal })
  } catch (error) {
    console.error('Goals PUT error:', error)
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 })
  }
}

// PATCH /api/goals - Update goal or task status
export async function PATCH(request: NextRequest) {
  try {
    const { type, id, status } = await request.json() as { type: string; id: string; status: string }

    if (!type || !id || !status) {
      return NextResponse.json(
        { error: 'type, id, and status are required' },
        { status: 400 }
      )
    }

    if (type === 'goal') {
      const validStatuses = ['Not Started', 'In Progress', 'Completed', 'Paused']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid goal status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        )
      }

      const goal = await db.goal.update({
        where: { id },
        data: { status },
        include: { tasks: true },
      })

      return NextResponse.json({ goal })
    } else if (type === 'task') {
      const validStatuses = ['Not Started', 'In Progress', 'Completed', 'Skipped']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid task status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        )
      }

      const task = await db.task.update({
        where: { id },
        data: { status },
      })

      return NextResponse.json({ task })
    } else {
      return NextResponse.json(
        { error: 'type must be "goal" or "task"' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Goals PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update goal/task' }, { status: 500 })
  }
}

// DELETE /api/goals?type=goal&id=xxx or ?type=task&id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'goal' or 'task'
    const id = searchParams.get('id')

    if (!type || !id) {
      return NextResponse.json({ error: 'type and id are required' }, { status: 400 })
    }

    if (type === 'goal') {
      await db.goal.delete({ where: { id } })
    } else if (type === 'task') {
      await db.task.delete({ where: { id } })
    } else {
      return NextResponse.json({ error: 'type must be "goal" or "task"' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Goals DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
