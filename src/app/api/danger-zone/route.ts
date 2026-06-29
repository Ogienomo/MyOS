import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/danger-zone — Delete ALL user data (Danger Zone)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { confirmation } = body

    if (confirmation !== 'DELETE EVERYTHING') {
      return NextResponse.json({ error: 'Confirmation phrase does not match' }, { status: 400 })
    }

    // Delete all data from all tables (except Auth, to keep access code)
    const tableDeletions = [
      db.checkIn.deleteMany(),
      db.lifeAreaScore.deleteMany(),
      db.financeEntry.deleteMany(),
      db.goal.deleteMany(),
      db.chatMessage.deleteMany(),
      db.memory.deleteMany(),
      db.driftAlert.deleteMany(),
      db.journalEntry.deleteMany(),
      db.lifeAreaProgress.deleteMany(),
      db.streak.deleteMany(),
      db.quickLog.deleteMany(),
      db.savingsGoal.deleteMany(),
      db.notificationLog.deleteMany(),
      db.monthlySummary.deleteMany(),
      db.habit.deleteMany(),
      db.customReminder.deleteMany(),
      db.customMoodTag.deleteMany(),
      db.weeklyReviewNote.deleteMany(),
      db.dashboardWidget.deleteMany(),
      // Delete user profile settings
      db.settings.deleteMany({
        where: { key: { in: ['user_name', 'os_name', 'setup_complete'] } }
      }),
    ]

    await db.$transaction(tableDeletions)

    // Reset auth so user has to set up again
    await db.auth.deleteMany()

    return NextResponse.json({ success: true, message: 'All data deleted successfully' })
  } catch (error) {
    console.error('Danger zone DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete data' }, { status: 500 })
  }
}
