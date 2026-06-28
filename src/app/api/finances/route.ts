import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { FinanceCreateSchema } from '@/lib/validation'

// GET /api/finances?from=YYYY-MM-DD&to=YYYY-MM-DD&type=received
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const type = searchParams.get('type')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)))

    const where: Record<string, unknown> = {}
    if (fromParam || toParam) {
      where.date = {}
      if (fromParam) (where.date as Record<string, string>).gte = fromParam
      if (toParam) (where.date as Record<string, string>).lte = toParam
    }
    if (type) where.type = type

    // Fetch all entries for summary, paginated entries for display
    const [entries, allEntries] = await Promise.all([
      db.financeEntry.findMany({ where, orderBy: { date: 'desc' }, skip: (page - 1) * limit, take: limit }),
      db.financeEntry.findMany({ where, orderBy: { date: 'desc' } }),
    ])
    const total = allEntries.length

    // Calculate summary totals from ALL entries (not just current page)
    const totalReceived = allEntries
      .filter((e) => e.type === 'received')
      .reduce((sum, e) => sum + e.amount, 0)
    const totalSpent = allEntries
      .filter((e) => e.type === 'spent')
      .reduce((sum, e) => sum + e.amount, 0)
    const alignedSpent = allEntries
      .filter((e) => e.type === 'spent' && e.aligned === true)
      .reduce((sum, e) => sum + e.amount, 0)
    const unalignedSpent = allEntries
      .filter((e) => e.type === 'spent' && e.aligned === false)
      .reduce((sum, e) => sum + e.amount, 0)

    // Category breakdown from all entries
    const categoryBreakdown: Record<string, { received: number; spent: number }> = {}
    for (const entry of allEntries) {
      if (!categoryBreakdown[entry.category]) {
        categoryBreakdown[entry.category] = { received: 0, spent: 0 }
      }
      if (entry.type === 'received') {
        categoryBreakdown[entry.category].received += entry.amount
      } else {
        categoryBreakdown[entry.category].spent += entry.amount
      }
    }

    return NextResponse.json({
      entries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalReceived,
        totalSpent,
        netFlow: totalReceived - totalSpent,
        alignedSpent,
        unalignedSpent,
        alignmentRatio: totalSpent > 0 ? alignedSpent / totalSpent : 1,
        categoryBreakdown,
      },
    })
  } catch (error) {
    console.error('Finances GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch finance entries' }, { status: 500 })
  }
}

// POST /api/finances - Create a new finance entry
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json()
    const parsed = FinanceCreateSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { date, type, amount, category, purpose, aligned, notes } = parsed.data

    const entry = await db.financeEntry.create({
      data: {
        date,
        type,
        amount,
        category,
        purpose: purpose || null,
        aligned: aligned !== undefined ? aligned : null,
        notes: notes || null,
      },
    })

    return NextResponse.json({ entry }, { status: 201 })
  } catch (error) {
    console.error('Finances POST error:', error)
    return NextResponse.json({ error: 'Failed to create finance entry' }, { status: 500 })
  }
}

// PUT /api/finances - Update an existing finance entry
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, date, type, amount, category, purpose, aligned, notes } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const existing = await db.financeEntry.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    if (type && !['received', 'spent'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be "received" or "spent"' },
        { status: 400 }
      )
    }

    if (amount !== undefined && (typeof amount !== 'number' || amount < 0)) {
      return NextResponse.json(
        { error: 'amount must be a non-negative number' },
        { status: 400 }
      )
    }

    const entry = await db.financeEntry.update({
      where: { id },
      data: {
        ...(date !== undefined && { date }),
        ...(type !== undefined && { type }),
        ...(amount !== undefined && { amount }),
        ...(category !== undefined && { category }),
        ...(purpose !== undefined && { purpose: purpose || null }),
        ...(aligned !== undefined && { aligned }),
        ...(notes !== undefined && { notes: notes || null }),
      },
    })

    return NextResponse.json({ entry })
  } catch (error) {
    console.error('Finances PUT error:', error)
    return NextResponse.json({ error: 'Failed to update finance entry' }, { status: 500 })
  }
}

// DELETE /api/finances?id=xxx - Delete a finance entry
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 })
    }

    const existing = await db.financeEntry.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    await db.financeEntry.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Finances DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete finance entry' }, { status: 500 })
  }
}
