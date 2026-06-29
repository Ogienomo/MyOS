import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userid'

const DEFAULT_WIDGETS = [
  { widgetId: 'checkin', visible: true, order: 0, collapsed: false },
  { widgetId: 'scores', visible: true, order: 1, collapsed: false },
  { widgetId: 'finances', visible: true, order: 2, collapsed: false },
  { widgetId: 'goals', visible: true, order: 3, collapsed: false },
  { widgetId: 'mood', visible: true, order: 4, collapsed: false },
  { widgetId: 'drift-alerts', visible: true, order: 5, collapsed: false },
  { widgetId: 'streaks', visible: true, order: 6, collapsed: false },
]

// GET /api/dashboard/widgets — list all widget settings
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request)
    let widgets = await db.dashboardWidget.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    })

    // Seed defaults if none exist
    if (widgets.length === 0) {
      await db.dashboardWidget.createMany({
        data: DEFAULT_WIDGETS.map(w => ({ ...w, userId })),
      })
      widgets = await db.dashboardWidget.findMany({
        where: { userId },
        orderBy: { order: 'asc' },
      })
    }

    return NextResponse.json(widgets)
  } catch (error) {
    console.error('Failed to fetch widgets:', error)
    return NextResponse.json({ error: 'Failed to fetch widgets' }, { status: 500 })
  }
}

// PUT /api/dashboard/widgets — update widget settings
export async function PUT(request: NextRequest) {
  try {
    const userId = getUserId(request)
    const body = await request.json()
    const { widgets } = body as {
      widgets: { widgetId: string; visible?: boolean; order?: number; collapsed?: boolean }[]
    }

    if (!Array.isArray(widgets)) {
      return NextResponse.json({ error: 'widgets must be an array' }, { status: 400 })
    }

    const results = []
    for (const w of widgets) {
      const data: { visible?: boolean; order?: number; collapsed?: boolean } = {}
      if (w.visible !== undefined) data.visible = w.visible
      if (w.order !== undefined) data.order = w.order
      if (w.collapsed !== undefined) data.collapsed = w.collapsed

      const updated = await db.dashboardWidget.update({
        where: { userId_widgetId: { userId, widgetId: w.widgetId } },
        data,
      })
      results.push(updated)
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Failed to update widgets:', error)
    return NextResponse.json({ error: 'Failed to update widgets' }, { status: 500 })
  }
}
