import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { db } from '@/lib/db'

// GET /api/google/callback - Handle OAuth callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        new URL(`/?google_error=${encodeURIComponent(error)}`, request.url)
      )
    }

    if (!code) {
      return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 })
    }

    // Get client ID from settings
    const clientIdSetting = await db.settings.findUnique({ where: { userId_key: { userId: 'default', key: 'google_client_id' } } })

    if (!clientIdSetting && !process.env.GOOGLE_CLIENT_ID) {
      return NextResponse.json({ error: 'Google Client ID not configured' }, { status: 400 })
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || clientIdSetting.value
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || ''

    if (!clientSecret) {
      return NextResponse.json({ error: 'Google Client Secret not configured' }, { status: 400 })
    }
    // Use request.nextUrl.origin instead of the origin header.
    // On Vercel deployments, the origin header may not match the actual host,
    // which causes a redirect_uri_mismatch when exchanging the auth code.
    const redirectUri = `${request.nextUrl.origin}/api/google/callback`
    console.log('[google/callback] Using redirectUri:', redirectUri)

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    )

    const { tokens } = await oauth2Client.getToken(code)
    console.log('[google/callback] Tokens obtained successfully')

    // Store tokens in Settings table
    await db.settings.upsert({
      where: { userId_key: { userId: 'default', key: 'google_tokens' } },
      update: { value: JSON.stringify(tokens) },
      create: { userId: 'default', key: 'google_tokens', value: JSON.stringify(tokens) },
    })

    // Redirect back to the app with success
    return NextResponse.redirect(
      new URL('/?google_connected=true', request.url)
    )
  } catch (error) {
    console.error('[google/callback] Error during OAuth callback:', error)
    const message = error instanceof Error ? error.message : 'Failed to complete OAuth'
    return NextResponse.redirect(
      new URL(`/?google_error=${encodeURIComponent(message)}`, request.url)
    )
  }
}
