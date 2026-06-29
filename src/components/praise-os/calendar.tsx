'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sun,
  Clock,
  Moon,
  TrendingUp,
  Sparkles,
  Calendar as CalendarIcon,
  ExternalLink,
  RefreshCw,
  Link2,
  Unlink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'

interface GoogleEvent {
  id: string
  summary: string
  description?: string
  start: string
  end: string
  location?: string
}

const checkInSchedule = [
  {
    type: 'morning',
    label: 'Morning Alignment',
    time: '5:00 AM',
    duration: '15 min',
    description: 'Set your day with intention. Share your schedule, feelings, priorities, and concerns.',
    output: ['Truth of the Moment', 'Big 3 Outcomes', 'Risk Alerts', 'Suggested Schedule', 'Required Actions'],
    icon: <Sun className="h-5 w-5 text-red-500" />,
    color: 'border-l-red-400 bg-white dark:bg-neutral-900',
    dot: 'bg-red-400',
  },
  {
    type: 'midday',
    label: 'Midday Correction',
    time: '12:00 PM',
    duration: '10 min',
    description: 'Reset your focus. Share what you\'ve completed, blockers, and what\'s slipping.',
    output: ['Progress Assessment', 'Focus Reset', 'Schedule Correction', 'Next Action'],
    icon: <Clock className="h-5 w-5 text-red-600" />,
    color: 'border-l-rose-400 bg-white dark:bg-neutral-900',
    dot: 'bg-rose-400',
  },
  {
    type: 'evening',
    label: 'Evening Review',
    time: '8:30 PM',
    duration: '20 min',
    description: 'Close your day with honesty. Share goals met/missed, money, business, distractions, lessons.',
    output: ['Wins', 'Lessons', 'Patterns', 'Drift Warnings', "Tomorrow's Corrections"],
    icon: <Moon className="h-5 w-5 text-rose-500" />,
    color: 'border-l-rose-500 bg-white dark:bg-neutral-900',
    dot: 'bg-rose-500',
  },
  {
    type: 'friday',
    label: 'Friday Strategic Review',
    time: '4:30 PM (Fridays)',
    duration: '45 min',
    description: 'Serious weekly review across all life areas: Faith, Health, Career, Business, Finances, Relationships, Growth.',
    output: ['Weekly Verdict', 'Goal Progress', 'Drift Analysis', 'Priority Corrections', 'Next Week Focus'],
    icon: <TrendingUp className="h-5 w-5 text-red-600" />,
    color: 'border-l-red-500 bg-white dark:bg-neutral-900',
    dot: 'bg-red-600',
  },
  {
    type: 'sunday',
    label: 'Weekly Planning',
    time: '6:00 PM (Sundays)',
    duration: '30 min',
    description: 'Review the upcoming week. Schedule priorities, identify deadlines, plan focus blocks.',
    output: ['Week Overview', 'Priority Schedule', 'Focus Blocks', 'Protected Commitments'],
    icon: <Sparkles className="h-5 w-5 text-rose-600" />,
    color: 'border-l-rose-600 bg-white dark:bg-neutral-900',
    dot: 'bg-rose-600',
  },
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function getCheckInsForDay(dayOfWeek: number): typeof checkInSchedule {
  const daily = checkInSchedule.filter(c => ['morning', 'midday', 'evening'].includes(c.type))
  if (dayOfWeek === 5) return [...daily, checkInSchedule.find(c => c.type === 'friday')!]
  if (dayOfWeek === 0) return [...daily, checkInSchedule.find(c => c.type === 'sunday')!]
  return daily
}

interface NewEventForm {
  title: string
  date: string
  startTime: string
  endTime: string
  description: string
}

export function Calendar() {
  const today = new Date()
  const { userSettings } = useAppStore()

  // Calendar navigation
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<Date | null>(today)

  // Google Calendar state
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [syncingCalendar, setSyncingCalendar] = useState(false)
  const [connectLoading, setConnectLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  // Event creation state
  const [showEventForm, setShowEventForm] = useState(false)
  const [creatingEvent, setCreatingEvent] = useState(false)
  const [createResult, setCreateResult] = useState<{ success: boolean; message: string } | null>(null)
  const [newEvent, setNewEvent] = useState<NewEventForm>({
    title: '',
    date: today.toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    description: '',
  })

  const checkGoogleConnection = useCallback(async () => {
    try {
      const res = await fetch('/api/google/calendar')
      if (res.ok) {
        const data = await res.json()
        setGoogleConnected(true)
        setGoogleEvents(data.events || [])
      } else {
        setGoogleConnected(false)
        setGoogleEvents([])
      }
    } catch {
      setGoogleConnected(false)
      setGoogleEvents([])
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('google_connected') === 'true') {
      setGoogleConnected(true)
      window.history.replaceState({}, '', '/')
    }
    if (params.get('google_error')) {
      setConnectionError(`Google Calendar connection failed: ${params.get('google_error')}. Please try again.`)
      window.history.replaceState({}, '', '/')
    }
    checkGoogleConnection()
  }, [checkGoogleConnection])

  const handleConnectGoogle = async () => {
    setConnectLoading(true)
    try {
      const res = await fetch('/api/google/auth-url')
      const data = await res.json()
      if (data.authUrl) window.location.href = data.authUrl
    } catch {
      // ignore
    } finally {
      setConnectLoading(false)
    }
  }

  const handleDisconnectGoogle = async () => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { ...userSettings, googleCalendarEnabled: false, googleEmailReminders: false } }),
      })
      setGoogleConnected(false)
      setGoogleEvents([])
    } catch {
      // ignore
    }
  }

  const handleRefreshEvents = async () => {
    setEventsLoading(true)
    try {
      const res = await fetch('/api/google/calendar')
      if (res.ok) {
        const data = await res.json()
        setGoogleEvents(data.events || [])
        setGoogleConnected(true)
      }
    } catch {
      // ignore
    } finally {
      setEventsLoading(false)
    }
  }

  const handleSyncCalendar = async () => {
    setSyncingCalendar(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/google/sync-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkInTimes: {
            morningTime: userSettings?.checkInWindows?.morningTime || '05:00',
            middayTime: '12:00',
            eveningTime: userSettings?.checkInWindows?.eveningTime || '20:30',
            fridayTime: '16:30',
            sundayTime: '18:00',
          },
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSyncResult({ success: true, message: data.message })
        handleRefreshEvents()
      } else {
        setSyncResult({ success: false, message: data.error || 'Failed to sync calendar' })
      }
    } catch {
      setSyncResult({ success: false, message: 'Network error. Please try again.' })
    } finally {
      setSyncingCalendar(false)
      setTimeout(() => setSyncResult(null), 5000)
    }
  }

  const handleCreateEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.date) return
    setCreatingEvent(true)
    setCreateResult(null)
    try {
      const startDateTime = `${newEvent.date}T${newEvent.startTime}:00`
      const endDateTime = `${newEvent.date}T${newEvent.endTime}:00`
      const res = await fetch('/api/google/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: newEvent.title,
          description: newEvent.description,
          startDateTime,
          endDateTime,
        }),
      })
      if (res.ok) {
        setCreateResult({ success: true, message: 'Event created successfully!' })
        setNewEvent({ title: '', date: today.toISOString().split('T')[0], startTime: '09:00', endTime: '10:00', description: '' })
        setShowEventForm(false)
        handleRefreshEvents()
      } else {
        const data = await res.json()
        setCreateResult({ success: false, message: data.error || 'Failed to create event' })
      }
    } catch {
      setCreateResult({ success: false, message: 'Network error. Please try again.' })
    } finally {
      setCreatingEvent(false)
      setTimeout(() => setCreateResult(null), 5000)
    }
  }

  const formatEventTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', ' ')
    } catch { return dateStr }
  }

  const formatEventDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const isToday = date.toDateString() === today.toDateString()
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
      const isTomorrow = date.toDateString() === tomorrow.toDateString()
      if (isToday) return 'Today'
      if (isTomorrow) return 'Tomorrow'
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    } catch { return '' }
  }

  // ── Interactive Month Calendar ──

  const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate()
  const getFirstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay()

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const daysInMonth = getDaysInMonth(viewMonth, viewYear)
  const firstDay = getFirstDayOfMonth(viewMonth, viewYear)

  // Get Google events for a specific calendar date
  const getEventsForDate = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return googleEvents.filter(e => e.start.startsWith(dateStr))
  }

  const isToday = (day: number) =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()

  const isSelected = (day: number) =>
    selectedDate !== null &&
    day === selectedDate.getDate() &&
    viewMonth === selectedDate.getMonth() &&
    viewYear === selectedDate.getFullYear()

  const selectedDateEvents = selectedDate
    ? googleEvents.filter(e => {
        const d = selectedDate
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        return e.start.startsWith(dateStr)
      })
    : []

  const selectedCheckIns = selectedDate ? getCheckInsForDay(selectedDate.getDay()) : []

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {connectionError && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300 flex-1">{connectionError}</p>
          <button onClick={() => setConnectionError(null)} className="text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-200">Calendar</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Your rhythm, schedule, and life operating cadence.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {googleConnected ? (
            <>
              {/* Add Event Button */}
              <Button
                size="sm"
                className="text-xs gap-1.5 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  setShowEventForm(v => !v)
                  if (selectedDate) {
                    setNewEvent(e => ({ ...e, date: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}` }))
                  }
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Event
              </Button>
              <Button variant="outline" size="sm" className="text-xs gap-1.5 dark:border-neutral-700 dark:text-neutral-300" onClick={handleRefreshEvents} disabled={eventsLoading}>
                <RefreshCw className={`h-3.5 w-3.5 ${eventsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" className="text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:text-red-400" onClick={handleDisconnectGoogle}>
                <Unlink className="h-3.5 w-3.5" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" className="text-xs gap-1.5 bg-red-600 hover:bg-red-700 text-white" onClick={handleConnectGoogle} disabled={connectLoading}>
              {connectLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              Connect Google Calendar
            </Button>
          )}
        </div>
      </div>

      {/* Google connection status */}
      {!googleConnected && (
        <Card className="shadow-sm border-dashed border-2 border-neutral-300 dark:border-neutral-700">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
              <CalendarIcon className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Connect Google Calendar</h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Sync check-in reminders and add events directly from MyOS.</p>
            </div>
          </CardContent>
        </Card>
      )}
      {googleConnected && (
        <Card className="shadow-sm bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
          <CardContent className="p-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="text-xs font-medium text-red-700 dark:text-red-400">Google Calendar connected</span>
          </CardContent>
        </Card>
      )}

      {/* Sync / Create Result */}
      {(syncResult || createResult) && (
        <Card className={`shadow-sm ${(syncResult || createResult)?.success ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200' : 'bg-red-100/60 border-red-400'}`}>
          <CardContent className="p-3 flex items-center gap-2">
            {(syncResult || createResult)?.success
              ? <CheckCircle2 className="h-4 w-4 text-red-600" />
              : <AlertCircle className="h-4 w-4 text-red-700" />}
            <span className="text-xs font-medium text-red-700 dark:text-red-400">{(syncResult || createResult)?.message}</span>
          </CardContent>
        </Card>
      )}

      {/* Add Event Form */}
      {showEventForm && googleConnected && (
        <Card className="shadow-sm border-red-200 dark:border-red-900">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm dark:text-neutral-200">New Google Calendar Event</CardTitle>
              <button onClick={() => setShowEventForm(false)} className="text-neutral-400 hover:text-neutral-600"><X className="h-4 w-4" /></button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <Input
              placeholder="Event title *"
              value={newEvent.title}
              onChange={e => setNewEvent(v => ({ ...v, title: e.target.value }))}
              className="text-sm h-9"
            />
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-neutral-500 dark:text-neutral-400">Date</label>
                <Input type="date" value={newEvent.date} onChange={e => setNewEvent(v => ({ ...v, date: e.target.value }))} className="text-xs h-8" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-neutral-500 dark:text-neutral-400">Start</label>
                <Input type="time" value={newEvent.startTime} onChange={e => setNewEvent(v => ({ ...v, startTime: e.target.value }))} className="text-xs h-8" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-neutral-500 dark:text-neutral-400">End</label>
                <Input type="time" value={newEvent.endTime} onChange={e => setNewEvent(v => ({ ...v, endTime: e.target.value }))} className="text-xs h-8" />
              </div>
            </div>
            <Input
              placeholder="Description (optional)"
              value={newEvent.description}
              onChange={e => setNewEvent(v => ({ ...v, description: e.target.value }))}
              className="text-sm h-9"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowEventForm(false)}>Cancel</Button>
              <Button size="sm" className="text-xs bg-red-600 hover:bg-red-700 text-white gap-1.5" onClick={handleCreateEvent} disabled={creatingEvent || !newEvent.title.trim()}>
                {creatingEvent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Create Event
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interactive Month Calendar */}
      <Card className="shadow-sm dark:border-neutral-700">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <CardTitle className="text-sm font-semibold dark:text-neutral-200">
              {MONTHS[viewMonth]} {viewYear}
            </CardTitle>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-neutral-400 dark:text-neutral-500 py-1">{d}</div>
            ))}
          </div>
          {/* Day grid */}
          <div className="grid grid-cols-7 gap-px">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-10" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayEvents = getEventsForDate(day)
              const dayCheckins = getCheckInsForDay(new Date(viewYear, viewMonth, day).getDay())
              const _today = isToday(day)
              const selected = isSelected(day)
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(new Date(viewYear, viewMonth, day))}
                  className={`h-10 rounded-lg flex flex-col items-center justify-center relative transition-colors
                    ${selected ? 'bg-red-600 text-white' : _today ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 ring-1 ring-red-300 dark:ring-red-800' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'}
                  `}
                >
                  <span className={`text-xs font-medium leading-none`}>{day}</span>
                  {/* Dots: check-in types for this day of week */}
                  <div className="flex gap-0.5 mt-0.5">
                    {dayCheckins.slice(0, 3).map(c => (
                      <span key={c.type} className={`w-1 h-1 rounded-full ${selected ? 'bg-white/60' : c.dot}`} />
                    ))}
                    {dayEvents.length > 0 && (
                      <span className={`w-1 h-1 rounded-full ${selected ? 'bg-white' : 'bg-blue-400'}`} />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Check-ins</span>
            </div>
            {googleConnected && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Google events</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-600" />
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Today</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Panel */}
      {selectedDate && (
        <Card className="shadow-sm dark:border-neutral-700">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm dark:text-neutral-200">
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </CardTitle>
              {googleConnected && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1 h-7 border-dashed border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                  onClick={() => {
                    const d = selectedDate
                    setNewEvent(e => ({ ...e, date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }))
                    setShowEventForm(true)
                  }}
                >
                  <Plus className="h-3 w-3" />
                  Add event
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {/* Check-ins for this day */}
            <div>
              <p className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wide">Scheduled Check-ins</p>
              <div className="space-y-1.5">
                {selectedCheckIns.map(ci => (
                  <div key={ci.type} className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
                    <span className={`w-2 h-2 rounded-full ${ci.dot} shrink-0`} />
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{ci.label}</span>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 ml-auto whitespace-nowrap">{ci.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Google events for this day */}
            {selectedDateEvents.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wide">Google Calendar</p>
                <div className="space-y-1.5">
                  {selectedDateEvents.map(ev => (
                    <div key={ev.id} className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900">
                      <span className="w-2 h-2 rounded-full bg-blue-400 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">{ev.summary || '(No title)'}</p>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                          {formatEventTime(ev.start)} — {formatEventTime(ev.end)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedDateEvents.length === 0 && !googleConnected && (
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 text-center py-1">Connect Google Calendar to see and add events.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sync Check-ins Button */}
      {googleConnected && (
        <Card className="shadow-sm dark:border-neutral-700">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
              <ExternalLink className="h-5 w-5 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Sync Check-ins to Google Calendar</h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Create recurring calendar events for all check-in windows (next 7 days).</p>
            </div>
            <Button size="sm" className="text-xs gap-1.5 bg-red-600 hover:bg-red-700 text-white shrink-0" onClick={handleSyncCalendar} disabled={syncingCalendar}>
              {syncingCalendar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sync
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Google Calendar Events List */}
      {googleConnected && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Upcoming Events</h3>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{googleEvents.length} events</span>
          </div>
          {eventsLoading ? (
            <Card className="shadow-sm dark:border-neutral-700">
              <CardContent className="p-6 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Loading events...</span>
              </CardContent>
            </Card>
          ) : googleEvents.length === 0 ? (
            <Card className="shadow-sm dark:border-neutral-700">
              <CardContent className="p-6 text-center">
                <CalendarIcon className="h-8 w-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
                <p className="text-xs text-neutral-500 dark:text-neutral-400">No upcoming events</p>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Sync check-ins or add events above</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
              {googleEvents.map(event => (
                <Card key={event.id} className="shadow-sm dark:border-neutral-700">
                  <CardContent className="p-3 flex items-start gap-3">
                    <div className="w-1 self-stretch rounded-full bg-blue-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{event.summary || '(No title)'}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Clock className="h-3 w-3 text-neutral-400 dark:text-neutral-500" />
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                          {formatEventDate(event.start)} · {formatEventTime(event.start)} — {formatEventTime(event.end)}
                        </span>
                      </div>
                      {event.location && <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 truncate">{event.location}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Check-in Schedule Details */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Check-in Schedule</h3>
        {checkInSchedule.map(checkin => (
          <Card key={checkin.type} className={`border-l-4 ${checkin.color} shadow-sm dark:border-neutral-700`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-neutral-800 flex items-center justify-center shadow-sm shrink-0">
                  {checkin.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h4 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{checkin.label}</h4>
                    <Badge variant="outline" className="text-[10px] dark:border-neutral-600 whitespace-nowrap">{checkin.time}</Badge>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2 leading-relaxed">{checkin.description}</p>
                  <div className="flex items-center gap-1 text-[10px] text-neutral-400 dark:text-neutral-500">
                    <Clock className="h-3 w-3" />
                    <span>{checkin.duration}</span>
                  </div>
                  <div className="mt-2.5">
                    <p className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">Expected Output:</p>
                    <div className="flex flex-wrap gap-1">
                      {checkin.output.map(item => (
                        <Badge key={item} variant="secondary" className="text-[9px] py-0 dark:bg-neutral-700 dark:text-neutral-300">{item}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Notification Schedule */}
      <Card className="shadow-sm dark:border-neutral-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm dark:text-neutral-200">Notification Schedule</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
            {[
              ['Morning Alignment', '5:00 AM + 10 min before'],
              ['Midday Correction', '12:00 PM'],
              ['Evening Review', '8:30 PM + 10 min before'],
              ['Friday Strategic', '4:30 PM + 30 min before'],
              ['Sunday Planning', '6:00 PM'],
            ].map(([label, time]) => (
              <div key={label} className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
                <span>{label}</span>
                <span className="text-neutral-400 dark:text-neutral-500 whitespace-nowrap">{time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
