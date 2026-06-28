'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/lib/store'

interface CustomReminder {
  id: string
  title: string
  message: string
  time: string // HH:mm
  days: string // JSON array of day numbers [1,2,3,4,5,6,7] (1=Monday)
  active: boolean
}

export function NotificationManager() {
  const { userSettings, dashboardData } = useAppStore()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastNotifRef = useRef<Record<string, number>>({})
  const remindersRef = useRef<CustomReminder[]>([])

  const subtractMinutes = useCallback((time: string, minutes: number): string => {
    const [h, m] = time.split(':').map(Number)
    const totalMinutes = h * 60 + m - minutes
    const newH = Math.floor(totalMinutes / 60)
    const newM = totalMinutes % 60
    return `${String(Math.max(0, newH)).padStart(2, '0')}:${String(Math.max(0, newM)).padStart(2, '0')}`
  }, [])

  const hasNotifiedToday = useCallback((key: string): boolean => {
    const lastTime = lastNotifRef.current[key]
    if (!lastTime) return false
    const today = new Date().toISOString().split('T')[0]
    const lastDate = new Date(lastTime).toISOString().split('T')[0]
    return today === lastDate
  }, [])

  const markNotified = useCallback((key: string) => {
    lastNotifRef.current[key] = Date.now()
  }, [])

  const sendNotification = useCallback((title: string, body: string, type: string) => {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: `myos-${type}-${Date.now()}`,
      })
      // Log to database
      fetch('/api/notifications/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message: body }),
      }).catch(() => {})
    } catch (e) {
      console.error('Notification failed:', e)
    }
  }, [])

  // Fetch custom reminders
  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/reminders')
      if (res.ok) {
        remindersRef.current = await res.json()
      }
    } catch {
      // Silently fail
    }
  }, [])

  useEffect(() => {
    // Request permission if not already granted
    if (userSettings?.notificationsEnabled && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      // Delay slightly to not spam on page load
      const timer = setTimeout(() => {
        Notification.requestPermission()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [userSettings?.notificationsEnabled])

  useEffect(() => {
    // Fetch reminders initially and every 5 minutes
    fetchReminders()
    const reminderFetchInterval = setInterval(fetchReminders, 5 * 60 * 1000)
    return () => clearInterval(reminderFetchInterval)
  }, [fetchReminders])

  useEffect(() => {
    // Main notification check interval - every 60 seconds
    intervalRef.current = setInterval(() => {
      if (!userSettings?.notificationsEnabled) return
      if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return

      const now = new Date()
      const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

      // Morning check-in reminder
      if (userSettings.morningReminderEnabled && userSettings.checkInWindows.morningEnabled) {
        const reminderTime = subtractMinutes(userSettings.checkInWindows.morningTime, userSettings.morningReminderMinutesBefore)
        if (nowStr === reminderTime && !hasNotifiedToday('morning-reminder')) {
          sendNotification(
            'Morning Check-in',
            'Time to start your day with intention. Open MyOS for your morning check-in.',
            'morning_reminder'
          )
          markNotified('morning-reminder')
        }
      }

      // Evening check-in reminder
      if (userSettings.eveningReminderEnabled && userSettings.checkInWindows.eveningEnabled) {
        const reminderTime = subtractMinutes(userSettings.checkInWindows.eveningTime, userSettings.eveningReminderMinutesBefore)
        if (nowStr === reminderTime && !hasNotifiedToday('evening-reminder')) {
          sendNotification(
            'Evening Check-in',
            'Wind down and reflect. Open MyOS for your evening check-in.',
            'evening_reminder'
          )
          markNotified('evening-reminder')
        }
      }

      // Mood nudge (if no mood log today by 2 PM)
      if (now.getHours() === 14 && now.getMinutes() === 0 && !hasNotifiedToday('mood-nudge')) {
        if (dashboardData && !dashboardData.todayQuickLog) {
          sendNotification(
            'How are you feeling?',
            "You haven't logged your mood today. A quick check-in helps track your patterns.",
            'mood_nudge'
          )
          markNotified('mood-nudge')
        }
      }

      // Drift alert escalation (check every hour on the hour)
      if (userSettings.driftAlertNotifications && now.getMinutes() === 0 && !hasNotifiedToday(`drift-${now.getHours()}`)) {
        if (dashboardData && dashboardData.activeDriftAlerts.length > 0) {
          const criticalAlerts = dashboardData.activeDriftAlerts.filter(a => a.severity === 'critical')
          if (criticalAlerts.length > 0) {
            sendNotification(
              'Drift Alert',
              `You have ${criticalAlerts.length} critical drift alert${criticalAlerts.length > 1 ? 's' : ''}. Check your life areas.`,
              'drift_alert'
            )
            markNotified(`drift-${now.getHours()}`)
          }
        }
      }

      // Streak celebration (check at 8 PM)
      if (userSettings.streakNotifications && now.getHours() === 20 && now.getMinutes() === 0 && !hasNotifiedToday('streak-check')) {
        if (dashboardData) {
          const longStreak = dashboardData.streaks.find(s => s.currentStreak >= 7 && s.currentStreak % 7 === 0)
          if (longStreak) {
            sendNotification(
              'Streak Milestone',
              `You've hit a ${longStreak.currentStreak}-day streak. Keep it going!`,
              'streak_celebration'
            )
            markNotified('streak-check')
          }
        }
      }

      // Auto monthly summary on the 1st of each month at 8:00 AM
      if (now.getDate() === 1 && now.getHours() === 8 && now.getMinutes() === 0 && !hasNotifiedToday('monthly-summary')) {
        // Trigger auto-generation for last month
        fetch('/api/monthly-summary/auto-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => {})

        sendNotification(
          'Monthly Summary Ready',
          'Your month in review is ready. Check Insights for your AI-generated summary.',
          'monthly_summary'
        )
        markNotified('monthly-summary')
      }

      // Custom reminders
      const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay() // Convert Sunday=0 to 7, Monday=1
      for (const reminder of remindersRef.current) {
        if (!reminder.active) continue
        if (reminder.time !== nowStr) continue
        if (!hasNotifiedToday(`custom-${reminder.id}`)) {
          try {
            const days = JSON.parse(reminder.days) as number[]
            if (days.includes(dayOfWeek)) {
              sendNotification(
                reminder.title,
                reminder.message,
                'custom_reminder'
              )
              markNotified(`custom-${reminder.id}`)
            }
          } catch {
            // Skip malformed reminder
          }
        }
      }
    }, 60000) // Check every minute

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [userSettings, dashboardData, subtractMinutes, hasNotifiedToday, markNotified, sendNotification])

  return null // Invisible component
}
