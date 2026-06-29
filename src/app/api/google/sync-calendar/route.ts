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

// POST /api/google/sync-calendar - Create calendar events for all check-in windows
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedClient()
    if (!auth) {
      return NextResponse.json(
        { error: 'Google not connected. Complete OAuth first.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { checkInTimes } = body as {
      checkInTimes?: {
        morningTime?: string
        middayTime?: string
        eveningTime?: string
        fridayTime?: string
        sundayTime?: string
      }
    }

    // Default times if not provided
    const morningTime = checkInTimes?.morningTime || '05:00'
    const middayTime = checkInTimes?.middayTime || '12:00'
    const eveningTime = checkInTimes?.eveningTime || '20:30'
    const fridayTime = checkInTimes?.fridayTime || '16:30'
    const sundayTime = checkInTimes?.sundayTime || '18:00'

    const calendar = google.calendar({ version: 'v3', auth })

    // Helper to create datetime string for a specific time today
    function createDateTime(timeStr: string, dayOffset = 0): string {
      const [hours, minutes] = timeStr.split(':').map(Number)
      const date = new Date()
      date.setDate(date.getDate() + dayOffset)
      date.setHours(hours, minutes, 0, 0)
      return date.toISOString()
    }

    // Helper to create end datetime (30 min after start)
    function createEndDateTime(timeStr: string, dayOffset = 0): string {
      const [hours, minutes] = timeStr.split(':').map(Number)
      const date = new Date()
      date.setDate(date.getDate() + dayOffset)
      date.setHours(hours, minutes + 30, 0, 0)
      return date.toISOString()
    }

    const createdEvents = []

    // Define the check-in events to create for the next 7 days
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date()
      date.setDate(date.getDate() + dayOffset)
      const dayOfWeek = date.getDay() // 0=Sun, 5=Fri

      // Daily check-ins: morning, midday, evening
      const dailyCheckIns = [
        {
          summary: 'Morning Alignment — MyOS',
          description: 'Set your day with intention. Share your schedule, feelings, priorities, and concerns.',
          time: morningTime,
        },
        {
          summary: 'Midday Correction — MyOS',
          description: 'Reset your focus. Share what you\'ve completed, blockers, and what\'s slipping.',
          time: middayTime,
        },
        {
          summary: 'Evening Review — MyOS',
          description: 'Close your day with honesty. Share goals met/missed, money, business, distractions, lessons.',
          time: eveningTime,
        },
      ]

      for (const checkIn of dailyCheckIns) {
        try {
          const response = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
              summary: checkIn.summary,
              description: checkIn.description,
              start: {
                dateTime: createDateTime(checkIn.time, dayOffset),
                timeZone: 'Africa/Lagos',
              },
              end: {
                dateTime: createEndDateTime(checkIn.time, dayOffset),
                timeZone: 'Africa/Lagos',
              },
              reminders: {
                useDefault: false,
                overrides: [
                  { method: 'popup', minutes: 30 },
                  { method: 'email', minutes: 60 },
                ],
              },
            },
          })

          createdEvents.push({
            id: response.data.id,
            summary: response.data.summary,
            start: response.data.start?.dateTime || response.data.start?.date,
          })
        } catch (eventError) {
          console.error(`Failed to create event for ${checkIn.summary} (day offset ${dayOffset}):`, eventError)
        }
      }

      // Friday Strategic Review
      if (dayOfWeek === 5) {
        try {
          const response = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
              summary: 'Friday Strategic Review — MyOS',
              description: 'Serious weekly review across all life areas: Faith, Health, Career, Business, Finances, Relationships, Growth.',
              start: {
                dateTime: createDateTime(fridayTime, dayOffset),
                timeZone: 'Africa/Lagos',
              },
              end: {
                dateTime: createEndDateTime(fridayTime, dayOffset),
                timeZone: 'Africa/Lagos',
              },
              reminders: {
                useDefault: false,
                overrides: [
                  { method: 'popup', minutes: 30 },
                  { method: 'email', minutes: 60 },
                ],
              },
            },
          })

          createdEvents.push({
            id: response.data.id,
            summary: response.data.summary,
            start: response.data.start?.dateTime || response.data.start?.date,
          })
        } catch (eventError) {
          console.error(`Failed to create Friday event (day offset ${dayOffset}):`, eventError)
        }
      }

      // Sunday Weekly Planning
      if (dayOfWeek === 0) {
        try {
          const response = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
              summary: 'Sunday Weekly Planning — MyOS',
              description: 'Review the upcoming week. Schedule priorities, identify deadlines, plan focus blocks.',
              start: {
                dateTime: createDateTime(sundayTime, dayOffset),
                timeZone: 'Africa/Lagos',
              },
              end: {
                dateTime: createEndDateTime(sundayTime, dayOffset),
                timeZone: 'Africa/Lagos',
              },
              reminders: {
                useDefault: false,
                overrides: [
                  { method: 'popup', minutes: 30 },
                  { method: 'email', minutes: 60 },
                ],
              },
            },
          })

          createdEvents.push({
            id: response.data.id,
            summary: response.data.summary,
            start: response.data.start?.dateTime || response.data.start?.date,
          })
        } catch (eventError) {
          console.error(`Failed to create Sunday event (day offset ${dayOffset}):`, eventError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdEvents.length} check-in calendar events for the next 7 days`,
      events: createdEvents,
    }, { status: 201 })
  } catch (error) {
    console.error('Google sync-calendar error:', error)
    return NextResponse.json({ error: 'Failed to sync calendar events' }, { status: 500 })
  }
}
