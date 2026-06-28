import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/goals/tasks - Add a task to a goal
export async function POST(request: NextRequest) {
  try {
    const { goalId, title, difficulty, estimatedCost, notes, dependency } = await request.json() as { goalId: string; title: string; difficulty?: string; estimatedCost?: number; notes?: string; dependency?: string }

    if (!goalId || !title) {
      return NextResponse.json({ error: 'Goal ID and title are required' }, { status: 400 })
    }

    // Dedup check
    const existing = await db.task.findFirst({
      where: { goalId, title: { equals: title, mode: 'insensitive' } },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'A task with this title already exists in this goal' },
        { status: 409 }
      )
    }

    // Get max order
    const maxOrder = await db.task.findFirst({
      where: { goalId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const task = await db.task.create({
      data: {
        goalId,
        title,
        difficulty: difficulty || null,
        estimatedCost: estimatedCost || null,
        notes: notes || null,
        dependency: dependency || null,
        status: 'Not Started',
        order: (maxOrder?.order ?? 0) + 1,
      },
    })

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    console.error('Task POST error:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

// PUT /api/goals/tasks - Update a task
export async function PUT(request: NextRequest) {
  try {
    const { id, title, difficulty, estimatedCost, notes, status, dependency } = await request.json() as { id: string; title?: string; difficulty?: string; estimatedCost?: number; notes?: string; status?: string; dependency?: string }

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (title !== undefined) data.title = title
    if (difficulty !== undefined) data.difficulty = difficulty
    if (estimatedCost !== undefined) data.estimatedCost = estimatedCost
    if (notes !== undefined) data.notes = notes
    if (status !== undefined) data.status = status
    if (dependency !== undefined) data.dependency = dependency

    const task = await db.task.update({
      where: { id },
      data,
    })

    return NextResponse.json({ task })
  } catch (error) {
    console.error('Task PUT error:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

// DELETE /api/goals/tasks?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    await db.task.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Task DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
