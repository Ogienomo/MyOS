import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userid'

// POST /api/danger-zone — Delete ALL user data (Danger Zone)
export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request)
    const body = await request.json()
    const { confirmation } = body

    if (confirmation !== 'DELETE EVERYTHING') {
      return NextResponse.json({ error: 'Confirmation phrase does not match' }, { status: 400 })
    }

    // Delete all data from all tables (except Auth, to keep access code)
    const tableDeletions = [
      db.checkIn.deleteMany({ where: { userId } }),
      db.lifeAreaScore.deleteMany({ where: { userId } }),
      db.financeEntry.deleteMany({ where: { userId } }),
      db.goal.deleteMany({ where: { userId } }),
      db.chatMessage.deleteMany({ where: { userId } }),
      db.memory.deleteMany({ where: { userId } }),
      db.driftAlert.deleteMany({ where: { userId } }),
      db.journalEntry.deleteMany({ where: { userId } }),
      db.lifeAreaProgress.deleteMany({ where: { userId } }),
      db.streak.deleteMany({ where: { userId } }),
      db.quickLog.deleteMany({ where: { userId } }),
      db.savingsGoal.deleteMany({ where: { userId } }),
      db.notificationLog.deleteMany({ where: { userId } }),
      db.monthlySummary.deleteMany({ where: { userId } }),
      db.habit.deleteMany({ where: { userId } }),
      db.customReminder.deleteMany({ where: { userId } }),
      db.customMoodTag.deleteMany({ where: { userId } }),
      db.weeklyReviewNote.deleteMany({ where: { userId } }),
      db.dashboardWidget.deleteMany({ where: { userId } }),
      // Delete user profile settings
      db.settings.deleteMany({
        where: { userId, key: { in: ['user_name', 'os_name', 'setup_complete'] } }
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
