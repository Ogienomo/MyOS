import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { db } from '@/lib/db'

async function getAuthenticatedClient() {
  const userId = 'default' // Google settings are shared
  const clientIdSetting = await db.settings.findUnique({ where: { userId_key: { userId, key: 'google_client_id' } } })
  const tokensSetting = await db.settings.findUnique({ where: { userId_key: { userId, key: 'google_tokens' } } })

  if ((!clientIdSetting && !process.env.GOOGLE_CLIENT_ID) || !tokensSetting) {
    return null
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || clientIdSetting!.value
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || ''

  if (!clientSecret) {
    return null
  }

  const tokens = JSON.parse(tokensSetting.value)

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret)
  oauth2Client.setCredentials(tokens)

  // Handle token refresh
  oauth2Client.on('tokens', async (newTokens) => {
    if (newTokens.refresh_token) {
      tokens.refresh_token = newTokens.refresh_token
    }
    tokens.access_token = newTokens.access_token
    await db.settings.upsert({
      where: { userId_key: { userId, key: 'google_tokens' } },
      update: { value: JSON.stringify(tokens) },
      create: { userId, key: 'google_tokens', value: JSON.stringify(tokens) },
    })
  })

  return oauth2Client
}

// POST /api/google/notify - Send email notification via Gmail
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedClient()
    if (!auth) {
      return NextResponse.json(
        { error: 'Google not connected. Complete OAuth first.' },
        { status: 401 }
      )
    }

    const { to, subject, message } = await request.json() as { to: string; subject: string; message: string }

    if (!to || !subject || !message) {
      return NextResponse.json(
        { error: 'to, subject, and message are required' },
        { status: 400 }
      )
    }

    const gmail = google.gmail({ version: 'v1', auth })

    // Construct raw email
    const emailLines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      message,
    ]

    const email = emailLines.join('\r\n')
    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
      },
    })

    return NextResponse.json({
      success: true,
      messageId: response.data.id,
    }, { status: 201 })
  } catch (error) {
    console.error('Google notify error:', error)
    return NextResponse.json({ error: 'Failed to send email notification' }, { status: 500 })
  }
}
