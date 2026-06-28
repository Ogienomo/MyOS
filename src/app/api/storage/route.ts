import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/storage — Returns storage statistics for the Settings page.
// Helps the user understand how much data they've accumulated and whether
// they're approaching any practical limits.
export async function GET() {
  try {
    const tables = [
      { name: 'Chat Messages', model: 'chatMessage', icon: 'chat' },
      { name: 'Check-ins', model: 'checkIn', icon: 'checkin' },
      { name: 'Journal Entries', model: 'journalEntry', icon: 'journal' },
      { name: 'Goals', model: 'goal', icon: 'goal' },
      { name: 'Tasks', model: 'task', icon: 'task' },
      { name: 'Finance Entries', model: 'financeEntry', icon: 'finance' },
      { name: 'Habits', model: 'habit', icon: 'habit' },
      { name: 'Habit Logs', model: 'habitLog', icon: 'habitlog' },
      { name: 'Quick Logs', model: 'quickLog', icon: 'mood' },
      { name: 'Life Area Scores', model: 'lifeAreaScore', icon: 'score' },
      { name: 'Life Area Progress', model: 'lifeAreaProgress', icon: 'progress' },
      { name: 'Memories', model: 'memory', icon: 'memory' },
      { name: 'Drift Alerts', model: 'driftAlert', icon: 'drift' },
      { name: 'Savings Goals', model: 'savingsGoal', icon: 'savings' },
      { name: 'Streaks', model: 'streak', icon: 'streak' },
      { name: 'Monthly Summaries', model: 'monthlySummary', icon: 'summary' },
      { name: 'Weekly Reviews', model: 'weeklyReviewNote', icon: 'weekly' },
      { name: 'Custom Reminders', model: 'customReminder', icon: 'reminder' },
      { name: 'Notifications', model: 'notificationLog', icon: 'notification' },
    ]

    const counts: Array<{ name: string; model: string; icon: string; count: number }> = []

    for (const table of tables) {
      try {
        const result = await (db as any)[table.model].count()
        counts.push({ ...table, count: typeof result === 'number' ? result : 0 })
      } catch {
        counts.push({ ...table, count: 0 })
      }
    }

    const totalRecords = counts.reduce((sum, t) => sum + t.count, 0)

    let dbSizeBytes: number | null = null
    let dbType = 'unknown'

    try {
      const dbUrl = process.env.DATABASE_URL || ''
      if (dbUrl.startsWith('file:')) {
        dbType = 'sqlite'
        try {
          const sizeResult = await db.$queryRaw<Array<{ page_size: number; page_count: number }>>`SELECT page_size, page_count FROM pragma_page_size(), pragma_page_count()`
          if (Array.isArray(sizeResult) && sizeResult.length > 0) {
            dbSizeBytes = Number(sizeResult[0].page_size) * Number(sizeResult[0].page_count)
          }
        } catch {
          dbSizeBytes = totalRecords * 500
        }
      } else if (dbUrl.startsWith('postgres')) {
        dbType = 'postgres'
        dbSizeBytes = totalRecords * 500
      } else {
        dbType = 'external'
        dbSizeBytes = totalRecords * 500
      }
    } catch {
      dbSizeBytes = totalRecords * 500
    }

    const formatSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    }

    return NextResponse.json({
      tables: counts,
      totalRecords,
      dbSizeBytes,
      dbSizeFormatted: dbSizeBytes !== null ? formatSize(dbSizeBytes) : 'Unknown',
      dbType,
      storageInfo: {
        type: dbType === 'sqlite' ? 'Local Database (SQLite)' : dbType === 'postgres' ? 'Cloud Database (Postgres)' : 'External Database',
        description: dbType === 'sqlite'
          ? 'Your data is stored in a local SQLite database file. There is no hard limit — you have as much space as your device/server storage allows. For context, 10,000 chat messages is roughly 5 MB. You would need millions of records to approach any limit.'
          : 'Your data is stored in a cloud database. Storage limits depend on your hosting plan. For typical personal use (thousands of records), you will not approach any limit for years.',
        canRunOutOfSpace: false,
        recommendation: 'For a personal life-operating system used by one person, storage will never be a concern. Even with daily check-ins, journaling, and AI conversations for 50+ years, you would use less than 1 GB.',
      },
    })
  } catch (error) {
    console.error('Storage API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch storage stats', tables: [], totalRecords: 0 },
      { status: 500 }
    )
  }
}
