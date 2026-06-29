import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userid'

const CATEGORY_LIMIT = 8

function truncate(text: string | null, maxLen: number = 200): string {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
}

export async function GET(request: NextRequest) {
  const userId = getUserId(request)
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 1) {
    return NextResponse.json({
      journal: [],
      memories: [],
      goals: [],
      finances: [],
      chat: [],
      alerts: [],
    })
  }

  const containsQuery = { contains: q }

  try {
    const [journal, memories, goals, finances, chat, alerts] = await Promise.all([
      db.journalEntry.findMany({
        where: {
          userId,
          OR: [
            { title: containsQuery },
            { content: containsQuery },
            { tags: containsQuery },
          ],
        },
        take: CATEGORY_LIMIT,
        orderBy: { date: 'desc' },
        select: {
          id: true,
          area: true,
          title: true,
          content: true,
          mood: true,
          date: true,
        },
      }),
      db.memory.findMany({
        where: {
          userId,
          content: containsQuery,
        },
        take: CATEGORY_LIMIT,
        orderBy: { date: 'desc' },
        select: {
          id: true,
          type: true,
          area: true,
          content: true,
          date: true,
        },
      }),
      db.goal.findMany({
        where: {
          userId,
          OR: [
            { title: containsQuery },
            { description: containsQuery },
            { whyItMatters: containsQuery },
          ],
        },
        take: CATEGORY_LIMIT,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          area: true,
          title: true,
          description: true,
          whyItMatters: true,
          status: true,
        },
      }),
      db.financeEntry.findMany({
        where: {
          userId,
          OR: [
            { category: containsQuery },
            { purpose: containsQuery },
            { notes: containsQuery },
          ],
        },
        take: CATEGORY_LIMIT,
        orderBy: { date: 'desc' },
        select: {
          id: true,
          category: true,
          amount: true,
          type: true,
          date: true,
          purpose: true,
        },
      }),
      db.chatMessage.findMany({
        where: {
          userId,
          content: containsQuery,
        },
        take: CATEGORY_LIMIT,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          content: true,
          role: true,
          checkInType: true,
          createdAt: true,
        },
      }),
      db.driftAlert.findMany({
        where: {
          userId,
          message: containsQuery,
        },
        take: CATEGORY_LIMIT,
        orderBy: { date: 'desc' },
        select: {
          id: true,
          area: true,
          severity: true,
          message: true,
          resolved: true,
          date: true,
        },
      }),
    ])

    return NextResponse.json({
      journal: journal.map((j) => ({
        id: j.id,
        area: j.area,
        title: j.title,
        content: truncate(j.content),
        mood: j.mood,
        date: j.date,
        type: 'journal' as const,
      })),
      memories: memories.map((m) => ({
        id: m.id,
        type: m.type,
        area: m.area,
        content: truncate(m.content),
        date: m.date,
        resultType: 'memory' as const,
      })),
      goals: goals.map((g) => ({
        id: g.id,
        area: g.area,
        title: g.title,
        description: truncate(g.description),
        whyItMatters: truncate(g.whyItMatters),
        status: g.status,
        type: 'goal' as const,
      })),
      finances: finances.map((f) => ({
        id: f.id,
        category: f.category,
        amount: f.amount,
        type: 'finance' as const,
        financeType: f.type,
        date: f.date,
        purpose: truncate(f.purpose),
      })),
      chat: chat.map((c) => ({
        id: c.id,
        content: truncate(c.content),
        role: c.role,
        checkInType: c.checkInType,
        date: c.createdAt,
        type: 'chat' as const,
      })),
      alerts: alerts.map((a) => ({
        id: a.id,
        area: a.area,
        severity: a.severity,
        message: truncate(a.message),
        resolved: a.resolved,
        date: a.date,
        type: 'alert' as const,
      })),
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
