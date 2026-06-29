import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userid'

interface BackupData {
  finances?: Array<Record<string, unknown>>
  journal?: Array<Record<string, unknown>>
  goals?: Array<Record<string, unknown>>
  memories?: Array<Record<string, unknown>>
  scores?: Array<Record<string, unknown>>
  checkins?: Array<Record<string, unknown>>
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request)
    const body: BackupData = await request.json()

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid backup data' }, { status: 400 })
    }

    const restored: Record<string, number> = {}
    const errors: string[] = []

    // Restore finances
    if (Array.isArray(body.finances) && body.finances.length > 0) {
      let count = 0
      for (const entry of body.finances) {
        try {
          if (!entry.date || !entry.type || entry.amount === undefined || !entry.category) continue
          await db.financeEntry.create({
            data: {
              userId,
              date: String(entry.date),
              type: String(entry.type),
              amount: Number(entry.amount),
              category: String(entry.category),
              purpose: entry.purpose ? String(entry.purpose) : null,
              aligned: entry.aligned != null ? Boolean(entry.aligned) : null,
              notes: entry.notes ? String(entry.notes) : null,
            },
          })
          count++
        } catch { /* skip duplicates or invalid entries */ }
      }
      restored.finances = count
    }

    // Restore journal
    if (Array.isArray(body.journal) && body.journal.length > 0) {
      let count = 0
      for (const entry of body.journal) {
        try {
          if (!entry.date || !entry.area || !entry.content) continue
          await db.journalEntry.create({
            data: {
              userId,
              date: String(entry.date),
              area: String(entry.area),
              title: entry.title ? String(entry.title) : null,
              content: String(entry.content),
              mood: entry.mood ? String(entry.mood) : null,
              tags: entry.tags ? String(entry.tags) : null,
            },
          })
          count++
        } catch { /* skip */ }
      }
      restored.journal = count
    }

    // Restore memories
    if (Array.isArray(body.memories) && body.memories.length > 0) {
      let count = 0
      for (const entry of body.memories) {
        try {
          if (!entry.type || !entry.area || !entry.content || !entry.date) continue
          await db.memory.create({
            data: {
              userId,
              type: String(entry.type),
              area: String(entry.area),
              content: String(entry.content),
              date: String(entry.date),
            },
          })
          count++
        } catch { /* skip */ }
      }
      restored.memories = count
    }

    // Restore goals (without tasks to avoid complexity)
    if (Array.isArray(body.goals) && body.goals.length > 0) {
      let count = 0
      for (const entry of body.goals) {
        try {
          if (!entry.area || !entry.title) continue
          // Check for existing goal with same title+area
          const existing = await db.goal.findFirst({
            where: { userId, area: String(entry.area), title: String(entry.title) },
          })
          if (existing) continue
          await db.goal.create({
            data: {
              userId,
              area: String(entry.area),
              title: String(entry.title),
              description: entry.description ? String(entry.description) : null,
              status: entry.status ? String(entry.status) : 'Not Started',
              whyItMatters: entry.whyItMatters ? String(entry.whyItMatters) : null,
              successMetric: entry.successMetric ? String(entry.successMetric) : null,
              targetDate: entry.targetDate ? String(entry.targetDate) : null,
              order: 0,
            },
          })
          count++
        } catch { /* skip */ }
      }
      restored.goals = count
    }

    const totalRestored = Object.values(restored).reduce((s, n) => s + n, 0)

    return NextResponse.json({
      success: true,
      message: `Restored ${totalRestored} records successfully.`,
      restored,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Restore error:', error)
    return NextResponse.json({ error: 'Failed to restore data' }, { status: 500 })
  }
}
