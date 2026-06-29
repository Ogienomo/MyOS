import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userid'

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request)
    const reminders = await db.customReminder.findMany({
      where: { userId },
      orderBy: { time: 'asc' },
    })

    return NextResponse.json(reminders)
  } catch (error) {
    console.error('Failed to fetch reminders:', error)
    return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request)
    const { title, message, time, days } = await request.json() as { title: string; message?: string; time: string; days: number[] | string }

    if (!title || !time || !days) {
      return NextResponse.json({ error: 'Title, time, and days are required' }, { status: 400 })
    }

    // Validate time format HH:mm
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return NextResponse.json({ error: 'Time must be in HH:mm format' }, { status: 400 })
    }

    // Validate days is an array of 1-7
    const parsedDays = typeof days === 'string' ? JSON.parse(days) : days
    if (!Array.isArray(parsedDays) || parsedDays.length === 0) {
      return NextResponse.json({ error: 'At least one day must be selected' }, { status: 400 })
    }
    if (!parsedDays.every((d: number) => d >= 1 && d <= 7)) {
      return NextResponse.json({ error: 'Days must be between 1 (Monday) and 7 (Sunday)' }, { status: 400 })
    }

    const reminder = await db.customReminder.create({
      data: {
        userId,
        title,
        message: message || '',
        time,
        days: typeof days === 'string' ? days : JSON.stringify(days),
        active: true,
      },
    })

    return NextResponse.json(reminder)
  } catch (error) {
    console.error('Failed to create reminder:', error)
    return NextResponse.json({ error: 'Failed to create reminder' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = getUserId(request)
    const { id, title, message, time, days, active } = await request.json() as { id: string; title?: string; message?: string; time?: string; days?: number[] | string; active?: boolean }

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const existing = await db.customReminder.findFirst({ where: { id, userId } })
    if (!existing) {
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (message !== undefined) updateData.message = message
    if (time !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(time)) {
        return NextResponse.json({ error: 'Time must be in HH:mm format' }, { status: 400 })
      }
      updateData.time = time
    }
    if (days !== undefined) {
      const parsedDays = typeof days === 'string' ? JSON.parse(days) : days
      if (!Array.isArray(parsedDays) || parsedDays.length === 0) {
        return NextResponse.json({ error: 'At least one day must be selected' }, { status: 400 })
      }
      updateData.days = typeof days === 'string' ? days : JSON.stringify(days)
    }
    if (active !== undefined) updateData.active = active

    const updated = await db.customReminder.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update reminder:', error)
    return NextResponse.json({ error: 'Failed to update reminder' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const userId = getUserId(request)
    const existing = await db.customReminder.findFirst({ where: { id, userId } })
    if (!existing) {
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })
    }

    await db.customReminder.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete reminder:', error)
    return NextResponse.json({ error: 'Failed to delete reminder' }, { status: 500 })
  }
}
