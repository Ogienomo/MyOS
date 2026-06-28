import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const SETTINGS_KEY = 'user_settings'

const DEFAULT_SETTINGS = {
  checkInWindows: {
    morningEnabled: true,
    morningTime: '05:00',
    eveningEnabled: true,
    eveningTime: '20:30',
    windowMinutes: 60,
    strictMode: false,
  },
  notificationsEnabled: true,
  morningReminderEnabled: true,
  eveningReminderEnabled: true,
  driftAlertNotifications: true,
  streakNotifications: true,
  morningReminderMinutesBefore: 10,
  eveningReminderMinutesBefore: 10,
  voiceNotesEnabled: true,
  imageUploadEnabled: true,
  darkMode: false,
  googleCalendarEnabled: false,
  googleEmailReminders: false,
  googleReminderEmail: '',
}

export async function GET() {
  try {
    const setting = await db.settings.findUnique({
      where: { key: SETTINGS_KEY },
    })

    const settings = setting ? JSON.parse(setting.value) : DEFAULT_SETTINGS
    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json({ settings: DEFAULT_SETTINGS })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { settings } = await request.json() as { settings: Record<string, unknown> }

    if (!settings) {
      return NextResponse.json({ error: 'Settings object is required' }, { status: 400 })
    }

    const value = JSON.stringify({ ...DEFAULT_SETTINGS, ...settings })

    await db.settings.upsert({
      where: { key: SETTINGS_KEY },
      update: { value },
      create: { key: SETTINGS_KEY, value },
    })

    return NextResponse.json({ success: true, settings: JSON.parse(value) })
  } catch (error) {
    console.error('Settings POST error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
