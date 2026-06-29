import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/user-profile — Get the user's name, OS name, and business profile
export async function GET() {
  try {
    const nameSetting = await db.settings.findUnique({ where: { key: 'user_name' } })
    const osSetting = await db.settings.findUnique({ where: { key: 'os_name' } })
    const setupSetting = await db.settings.findUnique({ where: { key: 'setup_complete' } })
    const businessNameSetting = await db.settings.findUnique({ where: { key: 'business_name' } })
    const businessDescSetting = await db.settings.findUnique({ where: { key: 'business_description' } })

    const userName = nameSetting?.value ? JSON.parse(nameSetting.value) : ''
    const osName = osSetting?.value ? JSON.parse(osSetting.value) : 'MyOS'
    const isSetupComplete = setupSetting?.value ? JSON.parse(setupSetting.value) : false
    const businessName = businessNameSetting?.value ? JSON.parse(businessNameSetting.value) : ''
    const businessDescription = businessDescSetting?.value ? JSON.parse(businessDescSetting.value) : ''

    return NextResponse.json({ userName, osName, isSetupComplete, businessName, businessDescription })
  } catch (error) {
    console.error('User profile GET error:', error)
    return NextResponse.json({ userName: '', osName: 'MyOS', isSetupComplete: false, businessName: '', businessDescription: '' })
  }
}

// POST /api/user-profile — Set the user's name and/or business profile
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, businessName, businessDescription } = body

    // At least one field must be provided
    if (!name && businessName === undefined && businessDescription === undefined) {
      return NextResponse.json({ error: 'At least one field is required' }, { status: 400 })
    }

    // Save name if provided
    if (name && typeof name === 'string' && name.trim().length >= 1) {
      const trimmedName = name.trim()
      const osName = `${trimmedName}OS`

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
    }

    // Save business name if provided
    if (businessName !== undefined && typeof businessName === 'string') {
      await db.settings.upsert({
        where: { key: 'business_name' },
        update: { value: JSON.stringify(businessName.trim()) },
        create: { key: 'business_name', value: JSON.stringify(businessName.trim()) },
      })
    }

    // Save business description if provided
    if (businessDescription !== undefined && typeof businessDescription === 'string') {
      await db.settings.upsert({
        where: { key: 'business_description' },
        update: { value: JSON.stringify(businessDescription.trim()) },
        create: { key: 'business_description', value: JSON.stringify(businessDescription.trim()) },
      })
    }

    // Return updated profile
    const [nameSetting, osSetting, businessNameSetting, businessDescSetting] = await Promise.all([
      db.settings.findUnique({ where: { key: 'user_name' } }),
      db.settings.findUnique({ where: { key: 'os_name' } }),
      db.settings.findUnique({ where: { key: 'business_name' } }),
      db.settings.findUnique({ where: { key: 'business_description' } }),
    ])

    return NextResponse.json({
      success: true,
      userName: nameSetting?.value ? JSON.parse(nameSetting.value) : '',
      osName: osSetting?.value ? JSON.parse(osSetting.value) : 'MyOS',
      businessName: businessNameSetting?.value ? JSON.parse(businessNameSetting.value) : '',
      businessDescription: businessDescSetting?.value ? JSON.parse(businessDescSetting.value) : '',
    })
  } catch (error) {
    console.error('User profile POST error:', error)
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }
}
