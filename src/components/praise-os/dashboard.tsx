'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore, DashboardData, QuickLogData, StreakData } from '@/lib/store'
import { ScoreCard } from './score-card'
import { DashboardSkeleton } from './loading-skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import {
  Sparkles, Sun, Clock, Moon, TrendingUp, AlertTriangle, DollarSign,
  ArrowRight, CheckCircle2, Circle, Loader2, Flame, Zap, Brain,
  Target, Heart, Activity, Briefcase, Gem, Users, Sprout, Wallet,
  RotateCcw, Trophy, AlertCircle, Timer, Bell, BellRing,
  Settings2, ChevronUp, ChevronDown, Eye, EyeOff, ChevronDownSquare,
  X, Lightbulb,
} from 'lucide-react'
import { motion } from 'framer-motion'

// ─── TIME ZONE ───────────────────────────────────────────────
const USER_TIMEZONE = 'Africa/Lagos'

// ─── CHECK-IN WINDOW DEFINITIONS (hour ranges in WAT) ────────
interface CheckInWindow {
  type: string
  label: string
  emoji: string
  startHour: number  // inclusive
  endHour: number    // exclusive
  deadlineHour: number // last acceptable hour (inclusive)
}

const CHECK_IN_WINDOWS: CheckInWindow[] = [
  { type: 'morning', label: 'Morning Alignment', emoji: '', startHour: 4, endHour: 10, deadlineHour: 11 },
  { type: 'midday', label: 'Midday Correction', emoji: '', startHour: 12, endHour: 14, deadlineHour: 15 },
  { type: 'evening', label: 'Evening Review', emoji: '', startHour: 18, endHour: 22, deadlineHour: 23 },
]

// ─── GRANULAR GREETING (11 time periods) ─────────────────────
function getSmartGreeting(completedCheckIns: string[]): { greeting: string; coachingMessage: string; period: string } {
  const hour = new Date().getHours()
  const day = new Date().getDay() // 0=Sun, 5=Fri
  const isFriday = day === 5
  const isSunday = day === 0

  let greeting = ''
  let coachingMessage = ''
  let period = ''

  if (hour >= 4 && hour < 5) {
    greeting = 'Rise and Align, Praise'
    period = 'dawn'
    coachingMessage = completedCheckIns.includes('morning')
      ? "You're up before the world. Morning check-in done — you're already winning."
      : "The early hours are sacred. Your morning check-in is waiting — start here."
  } else if (hour >= 5 && hour < 6) {
    greeting = 'Early Riser, Praise'
    period = 'early-morning'
    coachingMessage = completedCheckIns.includes('morning')
      ? "Early and aligned. This is the energy that builds empires."
      : "You're up early — don't waste it. Morning Alignment is open."
  } else if (hour >= 6 && hour < 8) {
    greeting = 'Good Morning, Praise'
    period = 'morning'
    coachingMessage = completedCheckIns.includes('morning')
      ? "Fresh start energy. You've set the tone — now execute."
      : "Fresh start energy. Don't waste it — do your Morning Alignment."
  } else if (hour >= 8 && hour < 10) {
    greeting = 'Morning, Praise'
    period = 'late-morning'
    coachingMessage = completedCheckIns.includes('morning')
      ? "Morning done. The day is moving — stay intentional."
      : "Your morning check-in window is closing. Urgency matters. Do it now."
  } else if (hour >= 10 && hour < 12) {
    greeting = 'Late Morning, Praise'
    period = 'late-morning-critical'
    coachingMessage = completedCheckIns.includes('morning')
      ? "Morning done, even if late. Now recover the day with focus."
      : "Praise, your morning check-in is critically overdue. No more delays — do it NOW."
  } else if (hour >= 12 && hour < 14) {
    greeting = 'Good Afternoon, Praise'
    period = 'afternoon'
    coachingMessage = completedCheckIns.includes('midday')
      ? "Midday correction done. You're on course — keep pushing."
      : "Midday check-in time. Are you on track or drifting? Find out now."
  } else if (hour >= 14 && hour < 16) {
    greeting = 'Afternoon, Praise'
    period = 'late-afternoon'
    coachingMessage = completedCheckIns.includes('midday')
      ? "Afternoon momentum. Stay the course."
      : "Midday check-in is still open but closing soon. Course-correct now."
  } else if (hour >= 16 && hour < 18) {
    greeting = 'Late Afternoon, Praise'
    period = 'late-afternoon-eve'
    coachingMessage = isFriday && !completedCheckIns.includes('friday')
      ? "Friday Strategic Review is due. Don't let the week end without accountability."
      : completedCheckIns.includes('midday')
        ? "Wrap-up focus. Start thinking about your evening review."
        : "Last chance for midday check-in. Evening review is coming."
  } else if (hour >= 18 && hour < 20) {
    greeting = 'Good Evening, Praise'
    period = 'evening'
    coachingMessage = completedCheckIns.includes('evening')
      ? "Evening review done. Time to rest or push further — your call."
      : "Evening review time. How did the day go? Account for it now."
  } else if (hour >= 20 && hour < 22) {
    greeting = 'Evening, Praise'
    period = 'late-evening'
    coachingMessage = completedCheckIns.includes('evening')
      ? "Evening review complete. Wind down with intention."
      : "Urgent: Your evening review is overdue. Don't skip accountability. Do it before bed."
  } else if (hour >= 22 && hour < 24) {
    greeting = 'Good Night, Praise'
    period = 'night'
    coachingMessage = completedCheckIns.includes('evening')
      ? "Evening review complete. Wind down — rest is discipline too."
      : "Last chance for your evening review. Don't let the day end without accounting for it."
  } else {
    // 12 AM - 4 AM
    greeting = "Praise, it's late"
    period = 'late-night'
    coachingMessage = "It's past your bedtime, . Rest is discipline too. Sleep now, align tomorrow."
  }

  // Override coaching message for Friday/Sunday specific check-ins
  if (isFriday && hour >= 16 && !completedCheckIns.includes('friday')) {
    coachingMessage = "Friday Strategic Review is due. Don't let the week end without accountability."
  }
  if (isSunday && hour >= 18 && !completedCheckIns.includes('sunday')) {
    coachingMessage = 'Sunday Planning awaits. Set up next week for success.'
  }

  return { greeting, coachingMessage, period }
}

// ─── SMART PROMPT (current expected check-in) ────────────────
function getSmartPrompt(completedCheckIns: string[], currentTime: Date): { title: string; description: string; urgency: 'normal' | 'high' | 'critical'; expectedType: string; windowEnd: Date | null } {
  const hour = currentTime.getHours()
  const day = currentTime.getDay()

  // Morning check-in urgency
  if (!completedCheckIns.includes('morning')) {
    if (hour >= 10) {
      const windowEnd = new Date(currentTime)
      windowEnd.setHours(11, 59, 59, 999)
      return { title: 'Morning Alignment Overdue', description: 'Praise, your morning check-in is overdue. Discipline starts here. Do it now.', urgency: 'critical', expectedType: 'morning', windowEnd }
    }
    if (hour >= 8) {
      const windowEnd = new Date(currentTime)
      windowEnd.setHours(9, 59, 59, 999)
      return { title: 'Morning Alignment', description: "Your morning check-in window is closing. Don't miss it.", urgency: 'high', expectedType: 'morning', windowEnd }
    }
    if (hour >= 5) {
      const windowEnd = new Date(currentTime)
      windowEnd.setHours(9, 59, 59, 999)
      return { title: 'Morning Alignment', description: 'Start your day with intention. Morning check-in is open.', urgency: 'normal', expectedType: 'morning', windowEnd }
    }
  }

  // Midday check-in
  if (!completedCheckIns.includes('midday') && hour >= 12) {
    if (hour >= 14) {
      const windowEnd = new Date(currentTime)
      windowEnd.setHours(14, 59, 59, 999)
      return { title: 'Midday Correction Overdue', description: 'Praise, your midday check-in is overdue. Course-correct now.', urgency: 'critical', expectedType: 'midday', windowEnd }
    }
    const windowEnd = new Date(currentTime)
    windowEnd.setHours(13, 59, 59, 999)
    return { title: 'Midday Correction', description: 'Are you on track? Quick check-in to course-correct.', urgency: 'normal', expectedType: 'midday', windowEnd }
  }

  // Evening check-in urgency
  if (!completedCheckIns.includes('evening')) {
    if (hour >= 22) {
      const windowEnd = new Date(currentTime)
      windowEnd.setHours(23, 59, 59, 999)
      return { title: 'Evening Review Overdue', description: 'Praise, skipping your evening review means skipping accountability. Do it before sleep.', urgency: 'critical', expectedType: 'evening', windowEnd }
    }
    if (hour >= 20) {
      const windowEnd = new Date(currentTime)
      windowEnd.setHours(21, 59, 59, 999)
      return { title: 'Evening Review', description: 'Time to account for your day. Evening check-in is open.', urgency: 'high', expectedType: 'evening', windowEnd }
    }
    if (hour >= 18) {
      const windowEnd = new Date(currentTime)
      windowEnd.setHours(21, 59, 59, 999)
      return { title: 'Evening Review', description: 'How did the day go? Account for it now.', urgency: 'normal', expectedType: 'evening', windowEnd }
    }
  }

  // Friday check-in
  if (day === 5 && !completedCheckIns.includes('friday') && hour >= 16) {
    const windowEnd = new Date(currentTime)
    windowEnd.setHours(23, 59, 59, 999)
    return { title: 'Friday Strategic Review', description: "Week review time. Don't let the week end without accountability.", urgency: 'high', expectedType: 'friday', windowEnd }
  }

  // Sunday check-in
  if (day === 0 && !completedCheckIns.includes('sunday') && hour >= 18) {
    const windowEnd = new Date(currentTime)
    windowEnd.setHours(23, 59, 59, 999)
    return { title: 'Sunday Planning', description: 'Plan the upcoming week. Set yourself up for alignment.', urgency: 'normal', expectedType: 'sunday', windowEnd }
  }

  // Default - show next check-in
  return { title: 'Stay Aligned', description: 'All check-ins completed. Keep the momentum going.', urgency: 'normal', expectedType: 'morning', windowEnd: null }
}

// ─── NUDGE SYSTEM: Calculate overdue check-ins with escalation ──
interface NudgeInfo {
  type: string
  label: string
  emoji: string
  minutesOverdue: number
  level: 'warning' | 'urgent' | 'critical'
  message: string
}

function getOverdueNudges(completedCheckIns: string[], currentTime: Date): NudgeInfo[] {
  const hour = currentTime.getHours()
  const minute = currentTime.getMinutes()
  const now = hour * 60 + minute
  const nudges: NudgeInfo[] = []

  // Morning: window closes at 10 AM (600 min), overdue after 10 AM
  if (!completedCheckIns.includes('morning') && now >= 600) {
    const minutesOverdue = now - 600
    if (minutesOverdue > 0) {
      nudges.push({
        type: 'morning',
        label: 'Morning Alignment',
        emoji: '',
        minutesOverdue,
        level: minutesOverdue >= 120 ? 'critical' : minutesOverdue >= 60 ? 'urgent' : 'warning',
        message: minutesOverdue >= 120
          ? `Your morning check-in is ${Math.floor(minutesOverdue / 60)}h ${minutesOverdue % 60}m overdue. This is critical, .`
          : minutesOverdue >= 60
            ? `Morning check-in is ${Math.floor(minutesOverdue / 60)}h overdue. Stop everything and do it now.`
            : `Morning check-in is ${minutesOverdue}m overdue. Don't let this slip.`,
      })
    }
  }

  // Midday: window closes at 14:00 (840 min), overdue after 14:00
  if (!completedCheckIns.includes('midday') && now >= 840) {
    const minutesOverdue = now - 840
    if (minutesOverdue > 0) {
      nudges.push({
        type: 'midday',
        label: 'Midday Correction',
        emoji: '',
        minutesOverdue,
        level: minutesOverdue >= 120 ? 'critical' : minutesOverdue >= 60 ? 'urgent' : 'warning',
        message: minutesOverdue >= 120
          ? `Midday check-in is ${Math.floor(minutesOverdue / 60)}h ${minutesOverdue % 60}m overdue. The day is slipping.`
          : minutesOverdue >= 60
            ? `Midday check-in is ${Math.floor(minutesOverdue / 60)}h overdue. Course-correct now.`
            : `Midday check-in is ${minutesOverdue}m overdue. Quick check-in to realign.`,
      })
    }
  }

  // Evening: window closes at 22:00 (1320 min), overdue after 22:00
  if (!completedCheckIns.includes('evening') && now >= 1320) {
    const minutesOverdue = now - 1320
    if (minutesOverdue > 0) {
      nudges.push({
        type: 'evening',
        label: 'Evening Review',
        emoji: '',
        minutesOverdue,
        level: minutesOverdue >= 120 ? 'critical' : minutesOverdue >= 60 ? 'urgent' : 'warning',
        message: minutesOverdue >= 120
          ? `Evening review is ${Math.floor(minutesOverdue / 60)}h overdue. Skipping accountability is not an option.`
          : minutesOverdue >= 60
            ? `Evening review is ${Math.floor(minutesOverdue / 60)}h overdue. Do it before you sleep.`
            : `Evening review is ${minutesOverdue}m overdue. Account for your day now.`,
      })
    }
  }

  // Sort by most critical first
  return nudges.sort((a, b) => {
    const levelOrder = { critical: 3, urgent: 2, warning: 1 }
    return levelOrder[b.level] - levelOrder[a.level]
  })
}

// ─── HELPERS ─────────────────────────────────────────────────
function formatTime(date: Date): string {
  let hours = date.getHours()
  const minutes = date.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  if (hours === 0) hours = 12
  return `${hours}:${minutes.toString().padStart(2, '0')}\u00A0${ampm}`
}

function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayH}:${m.toString().padStart(2, '0')}\u00A0${ampm}`
}

function getTimezoneAbbr(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: USER_TIMEZONE,
      timeZoneName: 'short',
    })
    const parts = formatter.formatToParts(new Date())
    const tzPart = parts.find(p => p.type === 'timeZoneName')
    return tzPart?.value || 'WAT'
  } catch {
    return 'WAT'
  }
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Closing now'
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${minutes}m left`
  if (minutes > 0) return `${minutes}m left`
  return 'Less than 1m left'
}

// ─── WIDGET SETTINGS INTERFACE ───────────────────────────────
interface WidgetSetting {
  id: string
  widgetId: string
  visible: boolean
  order: number
  collapsed: boolean
}

const WIDGET_LABELS: Record<string, { label: string; icon: string }> = {
  'checkin': { label: 'Check-in', icon: '' },
  'scores': { label: 'Life Scores', icon: '' },
  'finances': { label: 'Finances', icon: '' },
  'goals': { label: 'Goals & Tasks', icon: '' },
  'mood': { label: 'Daily Mood Log', icon: '' },
  'drift-alerts': { label: 'Drift Alerts', icon: '' },
  'streaks': { label: 'Streaks & Wins', icon: '' },
}

// ─── WIDGET WRAPPER COMPONENT ────────────────────────────────
function WidgetSection({ widgetId, widgetSettings, children }: {
  widgetId: string
  widgetSettings: WidgetSetting[]
  children: React.ReactNode
}) {
  const setting = widgetSettings.find(w => w.widgetId === widgetId)
  if (!setting || !setting.visible) return null
  if (setting.collapsed) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-neutral-400 dark:text-neutral-500">
            <span className="text-sm">{WIDGET_LABELS[widgetId]?.icon}</span>
            <span className="text-xs font-medium">{WIDGET_LABELS[widgetId]?.label}</span>
            <span className="text-[10px]">— collapsed</span>
          </div>
        </CardContent>
      </Card>
    )
  }
  return <>{children}</>
}

// ─── MAIN COMPONENT ──────────────────────────────────────────
export function Dashboard() {
  const { dashboardData, dashboardLoading, setDashboardData, setDashboardLoading, setActiveTab, setActiveCheckInType, todayQuickLog, setTodayQuickLog, lastSyncTimestamp, userSettings } = useAppStore()
  const [quickLogOpen, setQuickLogOpen] = useState(false)
  const [mood, setMood] = useState(5)
  const [energy, setEnergy] = useState(5)
  const [focus, setFocus] = useState(5)
  const [quickNote, setQuickNote] = useState('')
  const [submittingLog, setSubmittingLog] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [strictModeWarning, setStrictModeWarning] = useState<string | null>(null)
  const [greetingKey, setGreetingKey] = useState(0)
  const [widgetSettings, setWidgetSettings] = useState<WidgetSetting[]>([])
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [aiNudge, setAiNudge] = useState<{ message: string; area: string; priority: string; action: string; actionTab: string } | null>(null)
  const [nudgeDismissed, setNudgeDismissed] = useState(false)

  // Real-time clock - updates every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Greeting refresh every 60 seconds — forces re-evaluation of greeting/coaching
  useEffect(() => {
    const timer = setInterval(() => {
      setGreetingKey(prev => prev + 1)
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // Re-fetch dashboard data on mount and when sync timestamp changes
  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      const data = await res.json()
      setDashboardData(data as DashboardData)
    } catch (err) {
      console.error('Failed to fetch dashboard:', err)
    } finally {
      setDashboardLoading(false)
    }
  }, [setDashboardData, setDashboardLoading])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard, lastSyncTimestamp])

  // Listen for dashboard refresh events from other components (mood log, chat check-ins)
  useEffect(() => {
    const handleRefresh = () => {
      setDashboardLoading(true)
      fetch('/api/dashboard')
        .then(res => res.json())
        .then(data => setDashboardData(data as DashboardData))
        .catch(err => console.error('Failed to refresh dashboard:', err))
        .finally(() => setDashboardLoading(false))
    }
    window.addEventListener('myos-refresh-dashboard', handleRefresh)
    return () => window.removeEventListener('myos-refresh-dashboard', handleRefresh)
  }, [setDashboardData, setDashboardLoading])

  // Fetch widget settings
  useEffect(() => {
    const fetchWidgets = async () => {
      try {
        const res = await fetch('/api/dashboard/widgets')
        const data = await res.json()
        setWidgetSettings(data)
      } catch (err) {
        console.error('Failed to fetch widget settings:', err)
      }
    }
    fetchWidgets()
  }, [])

  // Fetch AI nudge
  useEffect(() => {
    const fetchNudge = async () => {
      try {
        const res = await fetch('/api/ai-nudge')
        const data = await res.json()
        if (data.nudges && data.nudges.length > 0) {
          setAiNudge(data.nudges[0])
        }
      } catch {
        // Silent fail
      }
    }
    fetchNudge()
    const interval = setInterval(fetchNudge, 2 * 60 * 60 * 1000) // every 2 hours
    return () => clearInterval(interval)
  }, [])

  const updateWidgetSettings = async (updates: { widgetId: string; visible?: boolean; order?: number; collapsed?: boolean }[]) => {
    try {
      const res = await fetch('/api/dashboard/widgets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: updates }),
      })
      const updated = await res.json()
      setWidgetSettings(updated)
    } catch (err) {
      console.error('Failed to update widget settings:', err)
    }
  }

  const handleWidgetToggle = (widgetId: string, visible: boolean) => {
    updateWidgetSettings([{ widgetId, visible }])
  }

  const handleWidgetCollapse = (widgetId: string, collapsed: boolean) => {
    updateWidgetSettings([{ widgetId, collapsed }])
  }

  const handleWidgetMove = (widgetId: string, direction: 'up' | 'down') => {
    const sorted = [...widgetSettings].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex(w => w.widgetId === widgetId)
    if (idx === -1) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === sorted.length - 1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const updates = [
      { widgetId: sorted[idx].widgetId, order: sorted[swapIdx].order },
      { widgetId: sorted[swapIdx].widgetId, order: sorted[idx].order },
    ]
    updateWidgetSettings(updates)
  }

  // Sort widget settings for rendering order
  const sortedWidgetSettings = [...widgetSettings].sort((a, b) => a.order - b.order)

  if (dashboardLoading || !dashboardData) {
    return <DashboardSkeleton />
  }

  const data = dashboardData as Record<string, unknown>
  const finSummary = data.financialSummary || {}
  const totalReceived = finSummary.weekReceived ?? finSummary.totalReceived ?? 0
  const totalSpent = finSummary.weekSpent ?? finSummary.totalSpent ?? 0
  const net = finSummary.weekNet ?? finSummary.net ?? 0
  const scores = data.todayScores ?? data.scores ?? null
  const nextCheckIn = data.nextCheckIn ?? null
  const goalStats = data.goalStats ?? { total: 0, completed: 0, inProgress: 0, notStarted: 0 }
  const taskStats = data.taskStats ?? { total: 0, completed: 0, inProgress: 0, notStarted: 0 }
  const activeAlerts = data.activeAlerts ?? data.activeDriftAlerts ?? []
  const recentCheckIns = data.recentCheckIns ?? []
  const streaks = (data.streaks ?? []) as StreakData[]
  const completedCheckInTypes = (data.completedCheckInTypes ?? []) as string[]

  const goalCompletion = goalStats.total > 0 ? Math.round((goalStats.completed / goalStats.total) * 100) : 0
  const taskCompletion = taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0

  const morningStreak = streaks.find(s => s.type === 'morning') || { currentStreak: 0, longestStreak: 0 }
  const eveningStreak = streaks.find(s => s.type === 'evening') || { currentStreak: 0, longestStreak: 0 }
  const overallStreak = streaks.find(s => s.type === 'overall') || { currentStreak: 0, longestStreak: 0 }
  const moodStreak = streaks.find(s => s.type === 'mood') || { currentStreak: 0, longestStreak: 0 }

  // Today's wins - what Praise has accomplished today
  const todaysWins = [
    { label: 'Morning Check-in', done: completedCheckInTypes.includes('morning') },
    { label: 'Midday Check-in', done: completedCheckInTypes.includes('midday') },
    { label: 'Evening Check-in', done: completedCheckInTypes.includes('evening') },
    { label: 'Quick Log', done: !!todayQuickLog },
  ]
  const winsCount = todaysWins.filter(w => w.done).length

  // Smart greeting and prompt — greetingKey forces refresh every 60s
  // (greetingKey is incremented by a 60s interval in the useEffect above)
  const { greeting: smartGreetingText, coachingMessage, period } = getSmartGreeting(completedCheckInTypes)
  void greetingKey // reference greetingKey so the 60s refresh triggers re-evaluation
  void period // period is used for debugging/logging if needed
  const smartPrompt = getSmartPrompt(completedCheckInTypes, currentTime)

  // Overdue nudges — recalculated every minute via greetingKey
  const overdueNudges = getOverdueNudges(completedCheckInTypes, currentTime)

  // Countdown to window closing
  const windowCountdown = (() => {
    if (!smartPrompt.windowEnd) return null
    const diff = smartPrompt.windowEnd.getTime() - currentTime.getTime()
    return diff > 0 ? diff : 0
  })()

  // Enhance coaching message with streak context
  const streakEnhancedCoaching = (() => {
    const allCheckInsDone = completedCheckInTypes.length >= 3
    let enhanced = coachingMessage
    if (overallStreak.currentStreak >= 7 && overallStreak.currentStreak < 14) {
      return enhanced + ` You're on a ${overallStreak.currentStreak}-day streak. Keep it going.`
    }
    if (overallStreak.currentStreak >= 14 && overallStreak.currentStreak < 30) {
      return enhanced + ` ${overallStreak.currentStreak}-day streak on fire. Don't break it now.`
    }
    if (overallStreak.currentStreak >= 30) {
      return enhanced + ` ${overallStreak.currentStreak}-day streak. You're unstoppable. Protect it.`
    }
    if (allCheckInsDone) {
      return enhanced + ' All check-ins done. Keep the momentum.'
    }
    return enhanced
  })()

  // Timezone display
  const tzAbbr = getTimezoneAbbr()

  const handleStartCheckIn = (type: string) => {
    // Check strict mode before navigating
    const settings = userSettings
    if (settings?.checkInWindows?.strictMode && ['morning', 'evening'].includes(type)) {
      const now = new Date()
      const currentMinutes = now.getHours() * 60 + now.getMinutes()

      if (type === 'morning' && settings.checkInWindows.morningEnabled) {
        const [h, m] = settings.checkInWindows.morningTime.split(':').map(Number)
        const target = h * 60 + m
        const windowMin = Math.max(0, target - settings.checkInWindows.windowMinutes)
        const windowMax = target + settings.checkInWindows.windowMinutes
        if (currentMinutes < windowMin || currentMinutes > windowMax) {
          // Strict mode blocked - don't navigate, show inline message
          setStrictModeWarning(`${type} check-in window is closed. Opens at ${formatMinutesToTime(windowMin)}. Strict mode is ON.`)
          setTimeout(() => setStrictModeWarning(null), 5000)
          return
        }
      }

      if (type === 'evening' && settings.checkInWindows.eveningEnabled) {
        const [h, m] = settings.checkInWindows.eveningTime.split(':').map(Number)
        const target = h * 60 + m
        const windowMin = Math.max(0, target - settings.checkInWindows.windowMinutes)
        const windowMax = target + settings.checkInWindows.windowMinutes
        if (currentMinutes < windowMin || currentMinutes > windowMax) {
          setStrictModeWarning(`${type} check-in window is closed. Opens at ${formatMinutesToTime(windowMin)}. Strict mode is ON.`)
          setTimeout(() => setStrictModeWarning(null), 5000)
          return
        }
      }
    }

    setActiveCheckInType(type)
    setActiveTab('chat')
  }

  const handleQuickLog = async () => {
    setSubmittingLog(true)
    try {
      const res = await fetch('/api/quicklog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood, energy, focus, note: quickNote }),
      })
      const result = await res.json()
      if (result.log) {
        setTodayQuickLog(result.log)
      }
      setQuickLogOpen(false)
      setQuickNote('')
    } catch (err) {
      console.error('Quick log error:', err)
    } finally {
      setSubmittingLog(false)
    }
  }

  const isCheckInCompleted = (type: string) => completedCheckInTypes.includes(type)

  // Determine current expected check-in label
  const getCurrentExpected = () => {
    const hour = currentTime.getHours()
    const day = currentTime.getDay()
    let currentExpectedType = nextCheckIn?.type || 'morning'
    let currentExpectedTime = nextCheckIn?.time || '5:00 AM'
    let currentExpectedLabel = 'Morning Alignment'

    if (hour >= 4 && hour < 12 && !completedCheckInTypes.includes('morning')) {
      currentExpectedType = 'morning'
      currentExpectedTime = '5:00 AM'
      currentExpectedLabel = 'Morning Alignment'
    } else if (hour >= 12 && hour < 16 && !completedCheckInTypes.includes('midday')) {
      currentExpectedType = 'midday'
      currentExpectedTime = '12:00 PM'
      currentExpectedLabel = 'Midday Correction'
    } else if (hour >= 16 && hour < 18 && !completedCheckInTypes.includes('midday')) {
      currentExpectedType = 'midday'
      currentExpectedTime = '12:00 PM'
      currentExpectedLabel = 'Midday Correction'
    } else if (hour >= 16 && hour < 22 && !completedCheckInTypes.includes('evening')) {
      currentExpectedType = 'evening'
      currentExpectedTime = '8:30 PM'
      currentExpectedLabel = 'Evening Review'
    } else if (day === 5 && hour >= 16 && !completedCheckInTypes.includes('friday')) {
      currentExpectedType = 'friday'
      currentExpectedTime = '4:30 PM'
      currentExpectedLabel = 'Friday Strategic Review'
    } else if (day === 0 && hour >= 18 && !completedCheckInTypes.includes('sunday')) {
      currentExpectedType = 'sunday'
      currentExpectedTime = '6:00 PM'
      currentExpectedLabel = 'Sunday Planning'
    } else if (hour >= 22 && !completedCheckInTypes.includes('evening')) {
      currentExpectedType = 'evening'
      currentExpectedTime = '8:30 PM'
      currentExpectedLabel = 'Evening Review'
    }

    return { currentExpectedType, currentExpectedTime, currentExpectedLabel }
  }

  const { currentExpectedType, currentExpectedTime, currentExpectedLabel } = getCurrentExpected()
  const isCurrentCompleted = isCheckInCompleted(currentExpectedType)

  return (
    <div className="space-y-6">
      {/* AI Proactive Nudge Banner */}
      {aiNudge && !nudgeDismissed && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-sm animate-slow-fade-in ${
          aiNudge.priority === 'high'
            ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
            : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
        }`}>
          <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            aiNudge.priority === 'high' ? 'bg-red-100 dark:bg-red-900/50' : 'bg-red-100 dark:bg-red-900/40'
          }`}>
            <Lightbulb className={`h-4 w-4 ${aiNudge.priority === 'high' ? 'text-red-600' : 'text-red-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${aiNudge.priority === 'high' ? 'text-red-800 dark:text-red-300' : 'text-red-800 dark:text-red-300'}`}>
              AI Coach Nudge
            </p>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">{aiNudge.message}</p>
            <button
              onClick={() => {
                setActiveTab(aiNudge.actionTab as any)
                setNudgeDismissed(true)
              }}
              className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 mt-2.5 inline-flex items-center gap-1"
            >
              {aiNudge.action} <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <button
            onClick={() => setNudgeDismissed(true)}
            className="shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Dashboard Customize Panel */}
      {customizeOpen && (
        <Card className="border-red-200 dark:border-red-900/30 shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-red-500" />
                <CardTitle className="text-sm">Customize Dashboard</CardTitle>
              </div>
              <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => setCustomizeOpen(false)}>
                Done
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {sortedWidgetSettings.map((w, idx) => (
                <div key={w.widgetId} className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleWidgetMove(w.widgetId, 'up')}
                      disabled={idx === 0}
                      className="p-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 disabled:opacity-20"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleWidgetMove(w.widgetId, 'down')}
                      disabled={idx === sortedWidgetSettings.length - 1}
                      className="p-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 disabled:opacity-20"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="text-sm flex-shrink-0">{WIDGET_LABELS[w.widgetId]?.icon}</span>
                  <span className="text-xs font-medium flex-1">{WIDGET_LABELS[w.widgetId]?.label || w.widgetId}</span>
                  <button
                    onClick={() => handleWidgetCollapse(w.widgetId, !w.collapsed)}
                    className={`p-1 rounded transition-colors ${w.collapsed ? 'text-red-500 hover:text-red-600' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
                    title={w.collapsed ? 'Expand' : 'Collapse'}
                  >
                    <ChevronDownSquare className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleWidgetToggle(w.widgetId, !w.visible)}
                    className={`p-1 rounded transition-colors ${w.visible ? 'text-red-500 hover:text-red-600' : 'text-neutral-300 dark:text-neutral-600 hover:text-neutral-400'}`}
                    title={w.visible ? 'Hide' : 'Show'}
                  >
                    {w.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Greeting Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 via-red-500 to-rose-400 p-6 text-white mb-6 shadow-lg shadow-red-600/20 ${
          smartPrompt.urgency === 'critical' ? 'ring-2 ring-rose-400 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900' : ''
        }`}>
        {/* Decorative background elements */}
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full" />
        <div className="absolute -right-2 -bottom-8 w-32 h-32 bg-white/5 rounded-full" />

        <div className="relative">
          {/* Top row: greeting + status badges */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xl md:text-2xl font-bold">{smartGreetingText}</h2>
            <div className="flex items-center gap-2">
              {/* Real-time clock with timezone */}
              <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5 backdrop-blur-sm">
                <Clock className="h-4 w-4 text-white/80" />
                <span className="text-sm font-mono text-white/90 tracking-wide whitespace-nowrap">{formatTime(currentTime)}</span>
                <span className="text-[10px] text-white/60 font-medium ml-0.5">{tzAbbr}</span>
              </div>
              {/* Streak badge */}
              <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 backdrop-blur-sm transition-all ${
                overallStreak.currentStreak >= 7 ? 'bg-white/25' :
                overallStreak.currentStreak >= 3 ? 'bg-white/20' :
                'bg-white/15'
              }`}>
                <Flame className="h-4 w-4 text-yellow-200 animate-slow-pulse" />
                <span className="text-sm font-bold" key={`streak-${overallStreak.currentStreak}`}>{overallStreak.currentStreak}d</span>
              </div>
              {/* Customize button */}
              <button
                onClick={() => setCustomizeOpen(!customizeOpen)}
                className="flex items-center gap-1 bg-white/15 rounded-full px-2.5 py-1.5 backdrop-blur-sm hover:bg-white/25 transition-colors"
                title="Customize Dashboard"
              >
                <Settings2 className="h-4 w-4 text-white/80" />
              </button>
            </div>
          </div>

          {/* Date display */}
          <div className="flex items-center gap-2 mt-1.5 mb-3">
            <span className="text-xs text-white/60">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>

          {/* Coaching Message */}
          <p className="text-sm text-white/80 mt-1">{streakEnhancedCoaching}</p>

          {/* CTA for pending check-in */}
          {smartPrompt.title !== 'Stay Aligned' && (
            <button
              onClick={() => setActiveTab('chat')}
              className="mt-3 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-4 py-2 rounded-full transition-colors"
            >
              Start your check-in →
            </button>
          )}

          {/* Smart prompt nudge */}
          <div className={`mt-4 rounded-xl p-3 ${
            smartPrompt.urgency === 'critical' ? 'bg-white/20' :
            smartPrompt.urgency === 'high' ? 'bg-white/15' :
            'bg-white/10'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {smartPrompt.urgency === 'critical' && <AlertCircle className="h-4 w-4 text-white shrink-0" />}
                  {smartPrompt.urgency === 'high' && <AlertTriangle className="h-4 w-4 text-white/90 shrink-0" />}
                  {smartPrompt.urgency === 'normal' && <Sun className="h-4 w-4 text-white/80 shrink-0" />}
                  <span className="text-sm font-semibold">{smartPrompt.title}</span>
                </div>
                <p className="text-xs sm:text-sm text-white/80 leading-relaxed">{smartPrompt.description}</p>
              </div>
              {/* Countdown timer */}
              {windowCountdown !== null && windowCountdown > 0 && (
                <div className={`sm:ml-3 shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                  windowCountdown < 30 * 60 * 1000
                    ? 'bg-white/25'
                    : 'bg-white/10'
                }`}>
                  <Timer className="h-3 w-3 text-white/80" />
                  <span className="text-[10px] font-mono text-white/90">{formatCountdown(windowCountdown)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Today's Discipline Score */}
      {(() => {
        const morningDone = completedCheckInTypes.includes('morning')
        const middayDone = completedCheckInTypes.includes('midday')
        const eveningDone = completedCheckInTypes.includes('evening')
        const moodDone = !!todayQuickLog
        const streakBonus = overallStreak.currentStreak >= 7
        const disciplineScore = (morningDone ? 25 : 0) + (middayDone ? 25 : 0) + (eveningDone ? 25 : 0) + (moodDone ? 15 : 0) + (streakBonus ? 10 : 0)
        const grade = disciplineScore >= 90 ? 'A' : disciplineScore >= 75 ? 'B' : disciplineScore >= 60 ? 'C' : disciplineScore >= 40 ? 'D' : 'F'
        const gradeColor = grade === 'A' ? 'text-red-600' : grade === 'B' ? 'text-red-500' : grade === 'C' ? 'text-rose-500' : grade === 'D' ? 'text-rose-600' : 'text-red-800'
        const tagline = grade === 'A' ? "Outstanding discipline today. You're aligned." : grade === 'B' ? 'Strong day. Keep pushing for A.' : grade === 'C' ? 'Average. You have more in the tank.' : grade === 'D' ? 'Below standard. Time to course-correct.' : 'Drift mode active. Get back on track NOW.'
        return (
          <div className="mb-6">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Today's Discipline Score</h3>
                <div className="flex items-center gap-2">
                  <span className={`text-3xl font-black ${gradeColor}`}>{grade}</span>
                  <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{disciplineScore} / 100</span>
                </div>
              </div>
              <Progress value={disciplineScore} className="h-3 mb-2" />
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">{tagline}</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Morning', done: morningDone },
                  { label: 'Midday', done: middayDone },
                  { label: 'Evening', done: eveningDone },
                  { label: 'Mood Log', done: moodDone },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col items-center gap-1">
                    {item.done
                      ? <CheckCircle2 className="h-5 w-5 text-red-500" />
                      : <Circle className="h-5 w-5 text-neutral-300 dark:text-neutral-600" />
                    }
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )
      })()}

      {/* Smart Nudge Banners — overdue check-ins with escalating urgency */}
      <WidgetSection widgetId="checkin" widgetSettings={widgetSettings}>
        {overdueNudges.length > 0 && (
        <div className="space-y-2">
          {overdueNudges.map((nudge) => (
            <div
              key={nudge.type}
              className={`rounded-xl p-4 border-2 ${
                nudge.level === 'critical' ? 'nudge-critical' :
                nudge.level === 'urgent' ? 'nudge-urgent' :
                'nudge-warning'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="shrink-0 mt-0.5">
                    {nudge.level === 'critical' ? (
                      <BellRing className="h-5 w-5" />
                    ) : (
                      <Bell className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold">{nudge.label}</span>
                      <Badge className={`text-[9px] shrink-0 ${
                        nudge.level === 'critical' ? 'bg-red-600 text-white' :
                        nudge.level === 'urgent' ? 'bg-red-500 text-white' :
                        'bg-red-400 text-white'
                      }`}>
                        {nudge.level === 'critical' ? 'CRITICAL' : nudge.level === 'urgent' ? 'URGENT' : 'WARNING'}
                      </Badge>
                    </div>
                    <p className="text-xs opacity-90">{nudge.message}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className={`w-full sm:w-auto sm:shrink-0 text-white font-bold text-xs px-4 py-2.5 sm:py-1.5 ${
                    nudge.level === 'critical' ? 'bg-red-700 hover:bg-red-800' :
                    nudge.level === 'urgent' ? 'bg-red-600 hover:bg-red-700' :
                    'bg-red-500 hover:bg-red-600'
                  }`}
                  onClick={() => handleStartCheckIn(nudge.type)}
                >
                  Do It Now
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        )}
      </WidgetSection>

      {/* Streaks Grid - subtle gradient backgrounds for active streaks */}
      <WidgetSection widgetId="streaks" widgetSettings={widgetSettings}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <Card className={`relative overflow-hidden h-full ${
          morningStreak.currentStreak >= 7 ? 'bg-gradient-to-br from-red-100 to-red-200 dark:from-red-950/40 dark:to-red-950/30 border-red-300 dark:border-red-800' :
          morningStreak.currentStreak >= 3 ? 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-950/20 border-red-300 dark:border-red-800' :
          morningStreak.currentStreak >= 1 ? 'bg-gradient-to-br from-red-50/50 to-neutral-50 dark:from-red-950/20 dark:to-neutral-900 border-red-200 dark:border-red-900' :
          'bg-gradient-to-br from-neutral-50 to-neutral-100/50 dark:from-neutral-900 dark:to-neutral-800 border-neutral-200 dark:border-neutral-800'
        }`}>
          <CardContent className="p-4 text-center">
            <Sun className={`h-5 w-5 mx-auto mb-1.5 ${morningStreak.currentStreak >= 3 ? 'text-red-500' : morningStreak.currentStreak >= 1 ? 'text-red-400' : 'text-neutral-500'}`} />
            <p className="text-xl font-bold text-neutral-800 dark:text-neutral-200 leading-tight" key={`m-${morningStreak.currentStreak}`}>{morningStreak.currentStreak}</p>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-snug">Morning Streak</p>
          </CardContent>
        </Card>
        <Card className={`relative overflow-hidden h-full ${
          eveningStreak.currentStreak >= 7 ? 'bg-gradient-to-br from-red-100 to-red-200 dark:from-red-950/40 dark:to-red-950/30 border-red-300 dark:border-red-800' :
          eveningStreak.currentStreak >= 3 ? 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-950/20 border-red-300 dark:border-red-800' :
          eveningStreak.currentStreak >= 1 ? 'bg-gradient-to-br from-red-50/50 to-neutral-50 dark:from-red-950/20 dark:to-neutral-900 border-red-200 dark:border-red-900' :
          'bg-gradient-to-br from-neutral-50 to-neutral-100/50 dark:from-neutral-900 dark:to-neutral-800 border-neutral-200 dark:border-neutral-800'
        }`}>
          <CardContent className="p-4 text-center">
            <Moon className={`h-5 w-5 mx-auto mb-1.5 ${eveningStreak.currentStreak >= 3 ? 'text-red-500' : eveningStreak.currentStreak >= 1 ? 'text-red-400' : 'text-neutral-500'}`} />
            <p className="text-xl font-bold text-neutral-800 dark:text-neutral-200 leading-tight" key={`e-${eveningStreak.currentStreak}`}>{eveningStreak.currentStreak}</p>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-snug">Evening Streak</p>
          </CardContent>
        </Card>
        <Card className={`relative overflow-hidden h-full ${
          overallStreak.currentStreak >= 7 ? 'bg-gradient-to-br from-red-100 to-red-200 dark:from-red-950/40 dark:to-red-950/30 border-red-300 dark:border-red-800' :
          overallStreak.currentStreak >= 3 ? 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-950/20 border-red-300 dark:border-red-800' :
          overallStreak.currentStreak >= 1 ? 'bg-gradient-to-br from-red-50/50 to-neutral-50 dark:from-red-950/20 dark:to-neutral-900 border-red-200 dark:border-red-900' :
          'bg-gradient-to-br from-neutral-50 to-neutral-100/50 dark:from-neutral-900 dark:to-neutral-800 border-neutral-200 dark:border-neutral-800'
        }`}>
          <CardContent className="p-4 text-center">
            <Target className={`h-5 w-5 mx-auto mb-1.5 ${overallStreak.currentStreak >= 3 ? 'text-red-500' : overallStreak.currentStreak >= 1 ? 'text-red-400' : 'text-neutral-500'}`} />
            <p className="text-xl font-bold text-neutral-800 dark:text-neutral-200 leading-tight" key={`o-${overallStreak.currentStreak}`}>{overallStreak.currentStreak}</p>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-snug">Check-in Streak</p>
          </CardContent>
        </Card>
        <Card className={`relative overflow-hidden h-full ${
          moodStreak.currentStreak >= 7 ? 'bg-gradient-to-br from-red-100 to-red-200 dark:from-red-950/40 dark:to-red-950/30 border-red-300 dark:border-red-800' :
          moodStreak.currentStreak >= 3 ? 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-950/20 border-red-300 dark:border-red-800' :
          moodStreak.currentStreak >= 1 ? 'bg-gradient-to-br from-red-50/50 to-neutral-50 dark:from-red-950/20 dark:to-neutral-900 border-red-200 dark:border-red-900' :
          'bg-gradient-to-br from-neutral-50 to-neutral-100/50 dark:from-neutral-900 dark:to-neutral-800 border-neutral-200 dark:border-neutral-800'
        }`}>
          <CardContent className="p-4 text-center">
            <Brain className={`h-5 w-5 mx-auto mb-1.5 ${moodStreak.currentStreak >= 3 ? 'text-red-500' : moodStreak.currentStreak >= 1 ? 'text-red-400' : 'text-neutral-500'}`} />
            <p className="text-xl font-bold text-neutral-800 dark:text-neutral-200 leading-tight" key={`mo-${moodStreak.currentStreak}`}>{moodStreak.currentStreak}</p>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-snug">Mood Streak</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Today's Wins */}
      <Card className="border-neutral-200 dark:border-neutral-800 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-neutral-500" />
              <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Today&apos;s Wins</span>
            </div>
            <Badge variant="secondary" className="text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700">
              {winsCount}/{todaysWins.length}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {todaysWins.map((win) => (
              <div
                key={win.label}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  win.done ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900' : 'bg-neutral-50 dark:bg-neutral-800/50'
                }`}
              >
                {win.done ? (
                  <CheckCircle2 className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-neutral-300 dark:text-neutral-600 shrink-0" />
                )}
                <span className={`text-xs ${win.done ? 'text-red-700 dark:text-red-300 font-medium' : 'text-neutral-400 dark:text-neutral-500'}`}>
                  {win.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </WidgetSection>

      {/* Quick Log — Daily Check-In */}
      <WidgetSection widgetId="mood" widgetSettings={widgetSettings}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
      >
      <Card className="border-neutral-200 dark:border-neutral-800 shadow-sm">
        <CardContent className="p-4">
          {todayQuickLog && !quickLogOpen ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Daily Check-In</span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 ml-2">Mood, Energy, Focus</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-red-500" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 h-7 px-2"
                    onClick={() => setQuickLogOpen(true)}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Log Again
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-3">Log anytime. Morning recommended. Track your baseline.</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <Heart className="h-4 w-4 text-red-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-neutral-800 dark:text-neutral-200">{todayQuickLog.mood}/10</p>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Mood</p>
                </div>
                <div className="text-center">
                  <Zap className="h-4 w-4 text-red-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-neutral-800 dark:text-neutral-200">{todayQuickLog.energy}/10</p>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Energy</p>
                </div>
                <div className="text-center">
                  <Brain className="h-4 w-4 text-red-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-neutral-800 dark:text-neutral-200">{todayQuickLog.focus}/10</p>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Focus</p>
                </div>
              </div>
            </div>
          ) : quickLogOpen ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Daily Check-In</span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 ml-2">Mood, Energy, Focus</span>
                </div>
                <button onClick={() => setQuickLogOpen(false)} className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300">Cancel</button>
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Log anytime. Morning recommended. Track your baseline.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center">
                  <Heart className="h-5 w-5 text-red-400 mx-auto mb-2" />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Mood: {mood}</p>
                  <Slider value={[mood]} onValueChange={([v]) => setMood(v)} min={1} max={10} step={1} className="w-full" />
                </div>
                <div className="text-center">
                  <Zap className="h-5 w-5 text-red-400 mx-auto mb-2" />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Energy: {energy}</p>
                  <Slider value={[energy]} onValueChange={([v]) => setEnergy(v)} min={1} max={10} step={1} className="w-full" />
                </div>
                <div className="text-center">
                  <Brain className="h-5 w-5 text-red-400 mx-auto mb-2" />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Focus: {focus}</p>
                  <Slider value={[focus]} onValueChange={([v]) => setFocus(v)} min={1} max={10} step={1} className="w-full" />
                </div>
              </div>
              <Button onClick={handleQuickLog} disabled={submittingLog} className="w-full bg-neutral-900 hover:bg-neutral-800 text-white">
                {submittingLog ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Log It
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Daily Check-In</span>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Mood, Energy, Focus</span>
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Log anytime. Morning recommended. Track your baseline.</p>
              <button
                onClick={() => setQuickLogOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-white rounded-lg bg-red-600 hover:bg-red-500 transition-colors duration-300 shadow-sm tap-feedback"
              >
                <Zap className="h-4 w-4" />
                Log Your Mood, Energy & Focus
              </button>
              <button
                onClick={() => setActiveTab('moodLog')}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors duration-300"
              >
                View Mood Log &amp; Trends
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </CardContent>
      </Card>
      </motion.div>
      </WidgetSection>

      {/* Next Check-in Card - with countdown and real-time alignment */}
      <WidgetSection widgetId="checkin" widgetSettings={widgetSettings}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
      >
      <Card className={`border-neutral-200 dark:border-neutral-800 shadow-sm ${
        smartPrompt.urgency === 'critical' ? 'bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/20 border-rose-300 dark:border-rose-800' :
        smartPrompt.urgency === 'high' ? 'bg-gradient-to-br from-neutral-50 to-rose-50/30 dark:from-neutral-900 dark:to-rose-950/20 border-neutral-300 dark:border-neutral-700' :
        'bg-gradient-to-br from-neutral-50 to-neutral-100/50 dark:from-neutral-900 dark:to-neutral-800 border-neutral-200 dark:border-neutral-800'
      }`}>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-neutral-500" />
              <CardTitle className="text-sm sm:text-base font-medium">{currentExpectedLabel}</CardTitle>
              {smartPrompt.urgency === 'critical' && (
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
              )}
              {smartPrompt.urgency === 'high' && (
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`whitespace-nowrap text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 ${
                smartPrompt.urgency === 'critical' ? 'bg-rose-100 dark:bg-rose-950/50' : 'bg-neutral-100 dark:bg-neutral-800'
              }`}>
                {currentExpectedTime}
              </Badge>
              {/* Countdown badge */}
              {windowCountdown !== null && windowCountdown > 0 && (
                <Badge className={`text-[10px] font-mono ${
                  windowCountdown < 30 * 60 * 1000
                    ? 'bg-rose-600 text-white'
                    : windowCountdown < 60 * 60 * 1000
                      ? 'bg-red-500 text-white'
                      : 'bg-red-100 text-red-700 border border-red-300'
                }`}>
                  <Timer className="h-3 w-3 mr-1" />
                  {formatCountdown(windowCountdown)}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-3 leading-relaxed">{smartPrompt.description}</p>
          {isCurrentCompleted ? (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>Completed for today</span>
            </div>
          ) : (
            <Button
              className={`w-full ${
                smartPrompt.urgency === 'critical' ? 'bg-rose-600 hover:bg-rose-700' :
                'bg-neutral-900 hover:bg-neutral-800'
              } text-white transition-colors`}
              onClick={() => handleStartCheckIn(currentExpectedType)}
            >
              Do Check-in
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>
      </motion.div>

      {/* Strict Mode Warning Banner */}
      {strictModeWarning && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="leading-relaxed">{strictModeWarning}</span>
        </div>
      )}

      {/* Quick Check-in Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { type: 'morning', label: 'Morning', desc: '5:00 AM' },
          { type: 'midday', label: 'Midday', desc: '12:00 PM' },
          { type: 'evening', label: 'Evening', desc: '8:30 PM' },
          { type: 'friday', label: 'Friday', desc: '4:30 PM' },
        ].map((checkin) => (
          <motion.button
            key={checkin.type}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleStartCheckIn(checkin.type)}
            className={`flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl border transition-colors duration-300 shadow-sm min-h-[84px] ${
              isCheckInCompleted(checkin.type)
                ? 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 opacity-70'
                : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-red-300 dark:hover:border-red-700 hover:bg-red-50 dark:hover:bg-red-950/20'
            }`}
          >
            <span className="text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300">{checkin.label}</span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 whitespace-nowrap">{checkin.desc}</span>
            {isCheckInCompleted(checkin.type) && (
              <CheckCircle2 className="h-3.5 w-3.5 text-red-500" />
            )}
          </motion.button>
        ))}
      </div>
      </WidgetSection>

      {/* Life Scores */}
      <WidgetSection widgetId="scores" widgetSettings={widgetSettings}>
      <ScoreCard scores={scores} />
      </WidgetSection>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <WidgetSection widgetId="goals" widgetSettings={widgetSettings}>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Goals Progress</span>
              <span className="text-xs text-neutral-400 dark:text-neutral-500">{goalStats.completed}/{goalStats.total}</span>
            </div>
            <Progress value={goalCompletion} className="h-2" />
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">{goalCompletion}% completed</p>
          </CardContent>
        </Card>
        </WidgetSection>

        <WidgetSection widgetId="goals" widgetSettings={widgetSettings}>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Tasks Progress</span>
              <span className="text-xs text-neutral-400 dark:text-neutral-500">{taskStats.completed}/{taskStats.total}</span>
            </div>
            <Progress value={taskCompletion} className="h-2" />
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">{taskCompletion}% completed</p>
          </CardContent>
        </Card>
        </WidgetSection>

        <WidgetSection widgetId="finances" widgetSettings={widgetSettings}>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4 text-red-500" />
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">This Week</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-red-600 dark:text-red-400">Received</span>
                <span className="font-medium text-neutral-800 dark:text-neutral-200">₦{Number(totalReceived).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-rose-500 dark:text-rose-400">Spent</span>
                <span className="font-medium text-neutral-800 dark:text-neutral-200">₦{Number(totalSpent).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs pt-2 mt-1 border-t border-neutral-200 dark:border-neutral-700">
                <span className="text-neutral-600 dark:text-neutral-400 font-medium">Net</span>
                <span className={`font-bold ${Number(net) >= 0 ? 'text-red-600 dark:text-red-400' : 'text-rose-500 dark:text-rose-400'}`}>
                  ₦{Number(net).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        </WidgetSection>
      </div>

      {/* Active Drift Alerts */}
      <WidgetSection widgetId="drift-alerts" widgetSettings={widgetSettings}>
      {activeAlerts.length > 0 && (
        <Card className="border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <CardTitle className="text-sm text-neutral-700 dark:text-neutral-300">Drift Alerts</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {activeAlerts.map((alert: { id: string; severity: string; message: string; area: string; date: string }) => (
                <div key={alert.id} className="flex items-start gap-3 border-l-2 border-red-300 pl-3">
                  <Badge variant="destructive" className="text-[10px] shrink-0">{alert.severity}</Badge>
                  <div>
                    <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-snug">{alert.message}</p>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">{alert.area} &bull; {alert.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </WidgetSection>

      {/* Recent Check-ins */}
      {recentCheckIns.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Recent Check-ins</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveTab('chat')}>
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {recentCheckIns.slice(0, 3).map((checkin: { id: string; type: string; date: string }) => (
                <div key={checkin.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <CheckCircle2 className="h-4 w-4 text-red-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 capitalize">{checkin.type} Check-in</p>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{checkin.date}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Done</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
