import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { type, message } = await request.json() as { type: string; message?: string }

    if (!type) {
      return NextResponse.json({ error: 'Type is required' }, { status: 400 })
    }

    const log = await db.notificationLog.create({
      data: {
        type,
        message: message || null,
        delivered: true,
      },
    })

    return NextResponse.json(log)
  } catch (error) {
    console.error('Failed to log notification:', error)
    return NextResponse.json({ error: 'Failed to log notification' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const logs = await db.notificationLog.findMany({
      orderBy: { sentAt: 'desc' },
      take: 50,
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error('Failed to fetch notification logs:', error)
    return NextResponse.json({ error: 'Failed to fetch notification logs' }, { status: 500 })
  }
}
