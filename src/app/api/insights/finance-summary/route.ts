import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/insights/finance-summary — Weekly financial auto-tracking summary
export async function GET() {
  try {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoStr = weekAgo.toISOString().split('T')[0]

    const entries = await db.financeEntry.findMany({
      where: { date: { gte: weekAgoStr } },
      orderBy: { date: 'desc' },
    })

    const received = entries
      .filter(e => e.type === 'received')
      .reduce((sum, e) => sum + e.amount, 0)
    const spent = entries
      .filter(e => e.type === 'spent')
      .reduce((sum, e) => sum + e.amount, 0)

    // Top spending categories
    const spendingByCategory: Record<string, number> = {}
    for (const e of entries.filter(e => e.type === 'spent')) {
      spendingByCategory[e.category] = (spendingByCategory[e.category] || 0) + e.amount
    }
    const topCategories = Object.entries(spendingByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount }))

    // Auto-detected entries (from smart-sync)
    const autoDetected = entries.filter(e => e.notes === 'Auto-detected from chat')

    return NextResponse.json({
      totalReceived: received,
      totalSpent: spent,
      netFlow: received - spent,
      topSpendingCategories: topCategories,
      autoDetectedEntries: autoDetected.map(e => ({
        id: e.id,
        date: e.date,
        type: e.type,
        amount: e.amount,
        category: e.category,
        purpose: e.purpose,
      })),
      totalEntries: entries.length,
      autoDetectedCount: autoDetected.length,
    })
  } catch (error) {
    console.error('Finance summary error:', error)
    return NextResponse.json(
      { error: 'Failed to generate finance summary' },
      { status: 500 }
    )
  }
}
