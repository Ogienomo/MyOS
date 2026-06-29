import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// All profile fields stored in Settings table
const PROFILE_FIELDS = [
  'user_name',
  'os_name',
  'setup_complete',
  'business_name',
  'business_description',
  'profile_photo',
  'bio',
  'location',
  'phone',
  'email',
  'personal_values',
  'mission_statement',
] as const

// GET /api/user-profile — Get the user's full profile
export async function GET() {
  try {
    const settings = await db.settings.findMany({
      where: { key: { in: PROFILE_FIELDS as unknown as string[] } },
    })

    const map: Record<string, string> = {}
    for (const s of settings) {
      map[s.key] = s.value
    }

    const parse = (key: string, fallback: unknown = '') => {
      try { return map[key] ? JSON.parse(map[key]) : fallback } catch { return fallback }
    }

    return NextResponse.json({
      userName: parse('user_name', ''),
      osName: parse('os_name', 'MyOS'),
      isSetupComplete: parse('setup_complete', false),
      businessName: parse('business_name', ''),
      businessDescription: parse('business_description', ''),
      profilePhoto: parse('profile_photo', ''),
      bio: parse('bio', ''),
      location: parse('location', ''),
      phone: parse('phone', ''),
      email: parse('email', ''),
      personalValues: parse('personal_values', []),
      missionStatement: parse('mission_statement', ''),
    })
  } catch (error) {
    console.error('User profile GET error:', error)
    return NextResponse.json({
      userName: '',
      osName: 'MyOS',
      isSetupComplete: false,
      businessName: '',
      businessDescription: '',
      profilePhoto: '',
      bio: '',
      location: '',
      phone: '',
      email: '',
      personalValues: [],
      missionStatement: '',
    })
  }
}

// POST /api/user-profile — Set any profile fields
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      businessName,
      businessDescription,
      profilePhoto,
      bio,
      location,
      phone,
      email,
      personalValues,
      missionStatement,
    } = body

    // Save name if provided (also generates os_name)
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

    // Helper to upsert a settings key
    const upsertField = async (key: string, value: unknown) => {
      if (value === undefined) return
      await db.settings.upsert({
        where: { key },
        update: { value: JSON.stringify(value) },
        create: { key, value: JSON.stringify(value) },
      })
    }

    // Save all optional profile fields
    if (businessName !== undefined) await upsertField('business_name', typeof businessName === 'string' ? businessName.trim() : businessName)
    if (businessDescription !== undefined) await upsertField('business_description', typeof businessDescription === 'string' ? businessDescription.trim() : businessDescription)
    if (profilePhoto !== undefined) await upsertField('profile_photo', profilePhoto)
    if (bio !== undefined) await upsertField('bio', typeof bio === 'string' ? bio.trim() : bio)
    if (location !== undefined) await upsertField('location', typeof location === 'string' ? location.trim() : location)
    if (phone !== undefined) await upsertField('phone', typeof phone === 'string' ? phone.trim() : phone)
    if (email !== undefined) await upsertField('email', typeof email === 'string' ? email.trim() : email)
    if (personalValues !== undefined) await upsertField('personal_values', personalValues)
    if (missionStatement !== undefined) await upsertField('mission_statement', typeof missionStatement === 'string' ? missionStatement.trim() : missionStatement)

    // Return updated profile
    const settings = await db.settings.findMany({
      where: { key: { in: PROFILE_FIELDS as unknown as string[] } },
    })

    const map: Record<string, string> = {}
    for (const s of settings) {
      map[s.key] = s.value
    }

    const parse = (key: string, fallback: unknown = '') => {
      try { return map[key] ? JSON.parse(map[key]) : fallback } catch { return fallback }
    }

    return NextResponse.json({
      success: true,
      userName: parse('user_name', ''),
      osName: parse('os_name', 'MyOS'),
      businessName: parse('business_name', ''),
      businessDescription: parse('business_description', ''),
      profilePhoto: parse('profile_photo', ''),
      bio: parse('bio', ''),
      location: parse('location', ''),
      phone: parse('phone', ''),
      email: parse('email', ''),
      personalValues: parse('personal_values', []),
      missionStatement: parse('mission_statement', ''),
    })
  } catch (error) {
    console.error('User profile POST error:', error)
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }
}
