import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userid'

// GET /api/finances/trends?months=6
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request)
    const { searchParams } = new URL(request.url)
    const months = parseInt(searchParams.get('months') || '6', 10)

    // Calculate date range
    const now = new Date()
    const fromDate = new Date(now.getFullYear(), now.getMonth() - months, 1)
    const fromStr = fromDate.toISOString().split('T')[0]

    // Fetch entries within the date range
    const entries = await db.financeEntry.findMany({
      where: {
        userId,
        date: { gte: fromStr },
      },
      orderBy: { date: 'asc' },
    })

    // Also fetch all entries for net balance calculation
    const allEntries = await db.financeEntry.findMany({ where: { userId } })

    // Aggregate by month
    const monthlyData: Record<string, { received: number; spent: number; net: number }> = {}

    // Initialize all months in range
    for (let i = months; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthlyData[key] = { received: 0, spent: 0, net: 0 }
    }

    for (const entry of entries) {
      const monthKey = entry.date.substring(0, 7) // YYYY-MM
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { received: 0, spent: 0, net: 0 }
      }
      if (entry.type === 'received') {
        monthlyData[monthKey].received += entry.amount
      } else {
        monthlyData[monthKey].spent += entry.amount
      }
      monthlyData[monthKey].net = monthlyData[monthKey].received - monthlyData[monthKey].spent
    }

    const monthly = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }))

    // Burn rate calculation
    const totalSpent = entries.filter(e => e.type === 'spent').reduce((sum, e) => sum + e.amount, 0)
    const daysInRange = Math.max(1, Math.ceil((now.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)))
    const burnRate = totalSpent / daysInRange

    // Net balance (all time)
    const totalReceivedAll = allEntries.filter(e => e.type === 'received').reduce((sum, e) => sum + e.amount, 0)
    const totalSpentAll = allEntries.filter(e => e.type === 'spent').reduce((sum, e) => sum + e.amount, 0)
    const netBalance = totalReceivedAll - totalSpentAll

    const runwayDays = burnRate > 0 ? Math.floor(netBalance / burnRate) : Infinity

    // Category breakdown for the period
    const categoryMap: Record<string, { amount: number; count: number; type: string }> = {}
    for (const entry of entries) {
      const key = entry.category
      if (!categoryMap[key]) {
        categoryMap[key] = { amount: 0, count: 0, type: entry.type }
      }
      categoryMap[key].amount += entry.amount
      categoryMap[key].count += 1
    }

    const totalSpentInPeriod = entries
      .filter(e => e.type === 'spent')
      .reduce((sum, e) => sum + e.amount, 0)
    const totalReceivedInPeriod = entries
      .filter(e => e.type === 'received')
      .reduce((sum, e) => sum + e.amount, 0)

    const categoryBreakdown = Object.entries(categoryMap).map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count,
      type: data.type,
      percentage: data.type === 'spent'
        ? (totalSpentInPeriod > 0 ? (data.amount / totalSpentInPeriod) * 100 : 0)
        : (totalReceivedInPeriod > 0 ? (data.amount / totalReceivedInPeriod) * 100 : 0),
    }))

    // This month vs last month comparison
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`

    const thisMonth = monthlyData[thisMonthKey] || { received: 0, spent: 0, net: 0 }
    const lastMonth = monthlyData[lastMonthKey] || { received: 0, spent: 0, net: 0 }

    return NextResponse.json({
      monthly,
      burnRate,
      runwayDays,
      netBalance,
      categoryBreakdown,
      thisMonth,
      lastMonth,
    })
  } catch (error) {
    console.error('Finances trends GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch trends data' }, { status: 500 })
  }
}
