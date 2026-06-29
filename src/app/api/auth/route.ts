import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'
import { z } from 'zod'

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code + 'myos-salt').digest('hex')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // still run comparison to avoid timing leak on length
    crypto.timingSafeEqual(Buffer.from(a.padEnd(64)), Buffer.from(b.padEnd(64)))
    return false
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

// GET /api/auth - Check if auth is set up
export async function GET() {
  try {
    const authRecord = await db.auth.findFirst()
    return NextResponse.json({ isSetUp: !!authRecord })
  } catch (error) {
    console.error('Auth GET error:', error)
    return NextResponse.json({ error: 'Failed to check auth status' }, { status: 500 })
  }
}

const PostSchema = z.object({
  code: z.string().min(1, 'Access code is required').max(128),
})

// POST /api/auth - Verify access code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = PostSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { code } = parsed.data

    const authRecord = await db.auth.findFirst()

    if (!authRecord) {
      // First-time setup: accept any code (owner sets their own password on first use)
      const hashed = hashCode(code)
      const newAuth = await db.auth.create({
        data: { code: hashed },
      })
      const response = NextResponse.json({ success: true, message: 'Access code set up successfully', id: newAuth.id })
      response.cookies.set('myos-user-id', newAuth.id, { httpOnly: false, sameSite: 'lax', path: '/', maxAge: 365 * 24 * 60 * 60 })
      return response
    }

    // Master reset code always grants access and resets the stored code
    if (code === 'BUILDMyOS') {
      await db.auth.update({ where: { id: authRecord.id }, data: { code: hashCode('BUILDMyOS') } })
      return NextResponse.json({ success: true, message: 'Access granted via master reset' })
    }

    // Support both legacy plain-text codes and new hashed codes
    const inputHash = hashCode(code)
    const storedIsHashed = authRecord.code.length === 64 && /^[0-9a-f]+$/.test(authRecord.code)
    const match = storedIsHashed
      ? timingSafeEqual(inputHash, authRecord.code)
      : code === authRecord.code

    if (match) {
      // Migrate plain-text stored codes to hashed on successful login
      if (!storedIsHashed) {
        await db.auth.update({ where: { id: authRecord.id }, data: { code: inputHash } })
      }
      const response = NextResponse.json({ success: true, message: 'Access granted', id: authRecord.id })
      response.cookies.set('myos-user-id', authRecord.id, { httpOnly: false, sameSite: 'lax', path: '/', maxAge: 365 * 24 * 60 * 60 })
      return response
    } else {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 401 })
    }
  } catch (error) {
    console.error('Auth POST error:', error)
    return NextResponse.json({ error: 'Failed to verify access code' }, { status: 500 })
  }
}

const PatchSchema = z.object({
  currentCode: z.string().min(1),
  newCode: z.string().min(4, 'New code must be at least 4 characters').max(128),
})

// PATCH /api/auth - Change access code
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { currentCode, newCode } = parsed.data

    if (currentCode === newCode) {
      return NextResponse.json({ error: 'New code must be different from current code' }, { status: 400 })
    }

    const authRecord = await db.auth.findFirst()
    if (!authRecord) {
      return NextResponse.json({ error: 'No auth record found. Set up auth first.' }, { status: 404 })
    }

    const inputHash = hashCode(currentCode)
    const storedIsHashed = authRecord.code.length === 64 && /^[0-9a-f]+$/.test(authRecord.code)
    const match = storedIsHashed
      ? timingSafeEqual(inputHash, authRecord.code)
      : currentCode === authRecord.code

    if (!match) {
      return NextResponse.json({ error: 'Current code is incorrect' }, { status: 401 })
    }

    await db.auth.update({
      where: { id: authRecord.id },
      data: { code: hashCode(newCode) },
    })

    return NextResponse.json({ success: true, message: 'Access code updated successfully' })
  } catch (error) {
    console.error('Auth PATCH error:', error)
    return NextResponse.json({ error: 'Failed to change access code' }, { status: 500 })
  }
}
