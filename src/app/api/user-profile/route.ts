import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/user-profile — Get the user's name and OS name
export async function GET() {
  try {
    const nameSetting = await db.settings.findUnique({ where: { key: 'user_name' } })
    const osSetting = await db.settings.findUnique({ where: { key: 'os_name' } })
    const setupSetting = await db.settings.findUnique({ where: { key: 'setup_complete' } })

    const userName = nameSetting?.value ? JSON.parse(nameSetting.value) : ''
    const osName = osSetting?.value ? JSON.parse(osSetting.value) : 'MyOS'
    const isSetupComplete = setupSetting?.value ? JSON.parse(setupSetting.value) : false

    return NextResponse.json({ userName, osName, isSetupComplete })
  } catch (error) {
    console.error('User profile GET error:', error)
    return NextResponse.json({ userName: '', osName: 'MyOS', isSetupComplete: false })
  }
}

// POST /api/user-profile — Set the user's name (first-run setup)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const trimmedName = name.trim()
    const osName = `${trimmedName}OS`

    // Upsert settings
    await db.settings.upsert({
      where: { key: 'user_name' },
      update: { value: JSON.stringify(trimmedName) },
      create: { key: 'user_name', value: JSON.stringify(trimmedName) },
    })

    await db.settings.upsert({
      where: { key: 'os_name' },
      update: { value: JSON.stringify(osName) },
      create: { key: 'os_name', value: JSON.stringify(osName) },
    })

    await db.settings.upsert({
      where: { key: 'setup_complete' },
      update: { value: JSON.stringify(true) },
      create: { key: 'setup_complete', value: JSON.stringify(true) },
    })

    return NextResponse.json({ success: true, userName: trimmedName, osName })
  } catch (error) {
    console.error('User profile POST error:', error)
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }
}
