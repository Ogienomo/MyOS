import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { db } from '@/lib/db'

async function getAuthenticatedClient() {
  const clientIdSetting = await db.settings.findUnique({ where: { key: 'google_client_id' } })
  const tokensSetting = await db.settings.findUnique({ where: { key: 'google_tokens' } })

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
      where: { key: 'google_tokens' },
      update: { value: JSON.stringify(tokens) },
      create: { key: 'google_tokens', value: JSON.stringify(tokens) },
    })
  })

  return oauth2Client
}

// GET /api/google/calendar - List upcoming events
export async function GET() {
  try {
    const auth = await getAuthenticatedClient()
    if (!auth) {
      return NextResponse.json(
        { error: 'Google not connected. Complete OAuth first.' },
        { status: 401 }
      )
    }

    const calendar = google.calendar({ version: 'v3', auth })

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 20,
      singleEvents: true,
      orderBy: 'startTime',
    })

    const events = (response.data.items || []).map((event) => ({
      id: event.id,
      summary: event.summary,
      description: event.description,
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      location: event.location,
    }))

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Google calendar GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 })
  }
}

// POST /api/google/calendar - Create a calendar event
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedClient()
    if (!auth) {
      return NextResponse.json(
        { error: 'Google not connected. Complete OAuth first.' },
        { status: 401 }
      )
    }

    const { summary, description, startDateTime, endDateTime, location, reminders } = await request.json() as { summary: string; description?: string; startDateTime: string; endDateTime: string; location?: string; reminders?: boolean }

    if (!summary || !startDateTime || !endDateTime) {
      return NextResponse.json(
        { error: 'summary, startDateTime, and endDateTime are required' },
        { status: 400 }
      )
    }

    const calendar = google.calendar({ version: 'v3', auth })

    const event: Record<string, unknown> = {
      summary,
      description: description || '',
      start: {
        dateTime: startDateTime,
        timeZone: 'Africa/Lagos',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Africa/Lagos',
      },
    }

    if (location) event.location = location

    if (reminders !== false) {
      event.reminders = {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'email', minutes: 60 },
        ],
      }
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    })

    return NextResponse.json({
      event: {
        id: response.data.id,
        summary: response.data.summary,
        start: response.data.start?.dateTime || response.data.start?.date,
        end: response.data.end?.dateTime || response.data.end?.date,
        htmlLink: response.data.htmlLink,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Google calendar POST error:', error)
    return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 500 })
  }
}
