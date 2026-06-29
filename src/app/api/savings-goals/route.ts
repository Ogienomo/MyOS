import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userid'

// GET /api/savings-goals
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request)
    const goals = await db.savingsGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ goals })
  } catch (error) {
    console.error('Savings goals GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch savings goals' }, { status: 500 })
  }
}

// POST /api/savings-goals - Create a new savings goal
export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request)
    const { name, targetAmount, savedAmount, deadline, area } = await request.json() as { name: string; targetAmount: number; savedAmount?: number; deadline?: string; area?: string }

    if (!name || targetAmount === undefined) {
      return NextResponse.json(
        { error: 'name and targetAmount are required' },
        { status: 400 }
      )
    }

    if (typeof targetAmount !== 'number' || targetAmount <= 0) {
      return NextResponse.json(
        { error: 'targetAmount must be a positive number' },
        { status: 400 }
      )
    }

    const goal = await db.savingsGoal.create({
      data: {
        userId,
        name,
        targetAmount,
        savedAmount: savedAmount || 0,
        deadline: deadline || null,
        area: area || null,
      },
    })

    return NextResponse.json({ goal }, { status: 201 })
  } catch (error) {
    console.error('Savings goals POST error:', error)
    return NextResponse.json({ error: 'Failed to create savings goal' }, { status: 500 })
  }
}

// PUT /api/savings-goals - Update a savings goal
export async function PUT(request: NextRequest) {
  try {
    const userId = getUserId(request)
    const { id, name, targetAmount, savedAmount, addAmount, deadline, area } = await request.json() as { id: string; name?: string; targetAmount?: number; savedAmount?: number; addAmount?: number; deadline?: string; area?: string }

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const existing = await db.savingsGoal.findFirst({ where: { id, userId } })
    if (!existing) {
      return NextResponse.json({ error: 'Savings goal not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (targetAmount !== undefined) updateData.targetAmount = targetAmount
    if (deadline !== undefined) updateData.deadline = deadline
    if (area !== undefined) updateData.area = area

    // Handle adding to savedAmount
    if (addAmount !== undefined) {
      updateData.savedAmount = existing.savedAmount + addAmount
    } else if (savedAmount !== undefined) {
      updateData.savedAmount = savedAmount
    }

    const goal = await db.savingsGoal.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ goal })
  } catch (error) {
    console.error('Savings goals PUT error:', error)
    return NextResponse.json({ error: 'Failed to update savings goal' }, { status: 500 })
  }
}

// DELETE /api/savings-goals - Delete a savings goal
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const userId = getUserId(request)
    const existing = await db.savingsGoal.findFirst({ where: { id, userId } })
    if (!existing) {
      return NextResponse.json({ error: 'Savings goal not found' }, { status: 404 })
    }

    await db.savingsGoal.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Savings goals DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete savings goal' }, { status: 500 })
  }
}
