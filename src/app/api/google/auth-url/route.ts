import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { db } from '@/lib/db'

// GET /api/google/auth-url - Generate Google OAuth URL
export async function GET(request: NextRequest) {
  try {
    // Get client ID from settings
    const clientIdSetting = await db.settings.findUnique({ where: { key: 'google_client_id' } })

    if (!clientIdSetting && !process.env.GOOGLE_CLIENT_ID) {
      return NextResponse.json(
        { error: 'Google Client ID not configured. Set GOOGLE_CLIENT_ID env var or add it in Settings.' },
        { status: 400 }
      )
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || clientIdSetting.value
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || ''

    if (!clientSecret) {
      return NextResponse.json(
        { error: 'Google Client Secret not configured. Set GOOGLE_CLIENT_SECRET env var.' },
        { status: 400 }
      )
    }
    // Use request.nextUrl.origin instead of the origin header.
    // On Vercel deployments, the origin header may not match the actual host
    // (e.g. it can be missing or differ due to proxying), which causes a
    // redirect_uri_mismatch error with Google OAuth. request.nextUrl.origin
    // reliably reflects the public URL of the deployment.
    const redirectUri = `${request.nextUrl.origin}/api/google/callback`
    console.log('[google/auth-url] Using redirectUri:', redirectUri)

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    )

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
    ]

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent to get refresh token
    })

    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error('[google/auth-url] Error generating auth URL:', error)
    return NextResponse.json(
      { error: `Failed to generate auth URL: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
