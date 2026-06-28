'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield, Loader2, CheckCircle2, AlertCircle, Clock, Bell, Mic, Camera, Lock, Sun, Moon, Monitor, Link2, Unlink, Mail, Calendar, RefreshCw, Key, Download, Wallet, BookOpen, Target, Brain, BarChart3, ClipboardCheck, Database, Plus, Trash2, AlarmClock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useAppStore, UserSettings } from '@/lib/store'
import { useTheme } from 'next-themes'
import { Checkbox } from '@/components/ui/checkbox'
import { motion, AnimatePresence } from 'framer-motion'

interface CustomReminder {
  id: string
  title: string
  message: string
  time: string
  days: string
  active: boolean
  createdAt: string
  updatedAt: string
}

const DAY_LABELS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
]

interface SettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DEFAULT_SETTINGS: UserSettings = {
  checkInWindows: {
    morningEnabled: true,
    morningTime: '05:00',
    eveningEnabled: true,
    eveningTime: '20:30',
    windowMinutes: 60,
    strictMode: false,
  },
  notificationsEnabled: true,
  morningReminderEnabled: true,
  eveningReminderEnabled: true,
  driftAlertNotifications: true,
  streakNotifications: true,
  morningReminderMinutesBefore: 10,
  eveningReminderMinutesBefore: 10,
  voiceNotesEnabled: true,
  imageUploadEnabled: true,
  darkMode: false,
  googleCalendarEnabled: false,
  googleEmailReminders: false,
  googleReminderEmail: '',
}

const tabContentVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
}

// ─── Danger Zone Component ───
function DangerZoneSection() {
  const { setIsAuthenticated, setIsSetupComplete } = useAppStore()
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleDeleteAll = async () => {
    if (confirmText !== 'DELETE EVERYTHING') return
    setDeleting(true)
    try {
      const res = await fetch('/api/danger-zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE EVERYTHING' }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        localStorage.removeItem('myos-auth')
        setIsAuthenticated(false)
        setIsSetupComplete(false)
        window.location.reload()
      } else {
        alert(data.error || 'Failed to delete data')
      }
    } catch {
      alert('Failed to delete data. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  if (!showConfirm) {
    return (
      <Button
        variant="destructive"
        className="w-full bg-red-600 hover:bg-red-700 text-white"
        onClick={() => setShowConfirm(true)}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Delete All Data
      </Button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3 p-4 rounded-xl border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
    >
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
        <AlertCircle className="h-5 w-5" />
        <p className="text-sm font-semibold">This will permanently erase everything</p>
      </div>
      <p className="text-xs text-red-600/80 dark:text-red-300/80">
        All goals, check-ins, finances, journal entries, habits, streaks, and settings will be deleted. 
        You will need to set up your OS again from scratch.
      </p>
      <div>
        <Label className="text-xs font-medium text-red-700 dark:text-red-300">
          Type <span className="font-mono font-bold">DELETE EVERYTHING</span> to confirm
        </Label>
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE EVERYTHING"
          className="mt-1 border-red-300 dark:border-red-800 focus-visible:border-red-500 focus-visible:ring-red-500/40"
        />
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => { setShowConfirm(false); setConfirmText('') }}
          disabled={deleting}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="flex-1 bg-red-600 hover:bg-red-700"
          disabled={confirmText !== 'DELETE EVERYTHING' || deleting}
          onClick={handleDeleteAll}
        >
          {deleting ? (
            <><Loader2 className="h-3 w-3 animate-spin mr-1" />Deleting...</>
          ) : (
            <><Trash2 className="h-3 w-3 mr-1" />Delete Everything</>
          )}
        </Button>
      </div>
    </motion.div>
  )
}

export function Settings({ open, onOpenChange }: SettingsProps) {
  const { userSettings, setUserSettings } = useAppStore()
  const { theme, setTheme } = useTheme()
  const [currentCode, setCurrentCode] = useState('')
  const [newCode, setNewCode] = useState('')
  const [confirmCode, setConfirmCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [localSettings, setLocalSettings] = useState<UserSettings>(userSettings || DEFAULT_SETTINGS)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  )
  const [activeTab, setActiveTab] = useState('checkins')

  // Google integration state
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleConnectLoading, setGoogleConnectLoading] = useState(false)
  const [googleError, setGoogleError] = useState('')
  const [googleSuccess, setGoogleSuccess] = useState('')
  const [googleEnvConfigured, setGoogleEnvConfigured] = useState<boolean | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null)
  const [exportLoading, setExportLoading] = useState<string | null>(null)
  const [storageData, setStorageData] = useState<{
    tables: Array<{ name: string; icon: string; count: number }>
    totalRecords: number
    dbSizeFormatted: string
    storageInfo: { type: string; description: string; recommendation: string }
  } | null>(null)
  const [storageLoading, setStorageLoading] = useState(false)

  // Custom reminders state
  const [reminders, setReminders] = useState<CustomReminder[]>([])
  const [remindersLoading, setRemindersLoading] = useState(false)
  const [showAddReminder, setShowAddReminder] = useState(false)
  const [newReminder, setNewReminder] = useState({
    title: '',
    message: '',
    time: '09:00',
    days: [1, 2, 3, 4, 5] as number[], // Weekdays default
  })

  useEffect(() => {
    if (open) {
      fetchSettings()
      checkGoogleConnection()
      checkGoogleEnvConfigured()
      fetchReminders()
      fetchStorageData()
    }
  }, [open])

  // Handle OAuth callback URL params
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const googleConnectedParam = params.get('google_connected')
    const googleErrorParam = params.get('google_error')

    if (googleConnectedParam === 'true') {
      setGoogleSuccess('Google account connected successfully!')
      // Clean up URL
      const url = new URL(window.location.href)
      url.searchParams.delete('google_connected')
      url.searchParams.delete('google_error')
      window.history.replaceState({}, '', url.toString())
      // Auto-clear after 5s
      setTimeout(() => setGoogleSuccess(''), 5000)
    }
    if (googleErrorParam) {
      setGoogleError(decodeURIComponent(googleErrorParam))
      // Clean up URL
      const url = new URL(window.location.href)
      url.searchParams.delete('google_connected')
      url.searchParams.delete('google_error')
      window.history.replaceState({}, '', url.toString())
      // Auto-clear after 8s
      setTimeout(() => setGoogleError(''), 8000)
    }
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (data.settings) {
        setLocalSettings(data.settings)
        setUserSettings(data.settings)
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    }
  }

  const checkGoogleConnection = useCallback(async () => {
    try {
      const res = await fetch('/api/google/calendar')
      if (res.ok) {
        setGoogleConnected(true)
      } else {
        setGoogleConnected(false)
      }
    } catch {
      setGoogleConnected(false)
    }
  }, [])

  const checkGoogleEnvConfigured = useCallback(async () => {
    try {
      const res = await fetch('/api/google/auth-url')
      if (res.ok) {
        const data = await res.json()
        setGoogleEnvConfigured(!!data.authUrl)
      } else {
        const data = await res.json().catch(() => ({}))
        setGoogleEnvConfigured(false)
      }
    } catch {
      setGoogleEnvConfigured(false)
    }
  }, [])

  const resetForm = () => {
    setCurrentCode('')
    setNewCode('')
    setConfirmCode('')
    setLoading(false)
    setSuccess(false)
    setError('')
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm()
    }
    onOpenChange(isOpen)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!currentCode.trim()) { setError('Current access code is required'); return }
    if (!newCode.trim()) { setError('New access code is required'); return }
    if (newCode.length < 4) { setError('New access code must be at least 4 characters'); return }
    if (newCode !== confirmCode) { setError('New codes do not match'); return }
    if (currentCode === newCode) { setError('New code must be different from current code'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentCode: currentCode.trim(), newCode: newCode.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSuccess(true)
        setTimeout(() => { handleClose(false) }, 1500)
      } else {
        setError(data.error || 'Failed to update access code')
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async (newSettings: UserSettings) => {
    setSettingsLoading(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings }),
      })
      const data = await res.json()
      if (data.success) {
        setLocalSettings(data.settings)
        setUserSettings(data.settings)
      }
    } catch (err) {
      console.error('Failed to save settings:', err)
    } finally {
      setSettingsLoading(false)
    }
  }

  const updateSetting = (key: string, value: boolean | number | string) => {
    const updated = { ...localSettings, [key]: value }
    setLocalSettings(updated)
    saveSettings(updated)
  }

  const updateCheckInWindow = (key: string, value: boolean | number | string) => {
    const updated = {
      ...localSettings,
      checkInWindows: { ...localSettings.checkInWindows, [key]: value },
    }
    setLocalSettings(updated)
    saveSettings(updated)
  }

  const handleRequestNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return
    }
    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
    if (permission === 'granted') {
      new Notification('MyOS Notifications Enabled', {
        body: 'You will now receive check-in reminders and alerts.',
        icon: '/logo.svg',
      })
    }
  }

  // Google integration handlers
  const handleConnectGoogle = async () => {
    setGoogleError('')
    setGoogleConnectLoading(true)
    try {
      const res = await fetch('/api/google/auth-url')
      const data = await res.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      } else if (data.error) {
        console.error('Google auth URL error:', data.error)
        setGoogleError(data.error)
        setGoogleEnvConfigured(false)
        setTimeout(() => setGoogleError(''), 8000)
      }
    } catch (err) {
      console.error('Failed to get Google auth URL:', err)
      setGoogleError('Failed to connect Google. Please check your network connection and try again.')
      setTimeout(() => setGoogleError(''), 8000)
    } finally {
      setGoogleConnectLoading(false)
    }
  }

  const handleDisconnectGoogle = async () => {
    try {
      const updated = {
        ...localSettings,
        googleCalendarEnabled: false,
        googleEmailReminders: false,
      }
      setLocalSettings(updated)
      await saveSettings(updated)
      setGoogleConnected(false)
    } catch (err) {
      console.error('Failed to disconnect Google:', err)
    }
  }

  const handleSyncCalendarReminders = async (enabled: boolean) => {
    updateSetting('googleCalendarEnabled', enabled)
    if (enabled && googleConnected) {
      setSyncLoading(true)
      setSyncResult(null)
      try {
        const res = await fetch('/api/google/sync-calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkInTimes: {
              morningTime: localSettings.checkInWindows.morningTime || '05:00',
              middayTime: '12:00',
              eveningTime: localSettings.checkInWindows.eveningTime || '20:30',
              fridayTime: '16:30',
              sundayTime: '18:00',
            },
          }),
        })
        const data = await res.json()
        if (res.ok && data.success) {
          setSyncResult({ success: true, message: data.message })
        } else {
          setSyncResult({ success: false, message: data.error || 'Failed to sync calendar' })
        }
      } catch {
        setSyncResult({ success: false, message: 'Network error. Please try again.' })
      } finally {
        setSyncLoading(false)
        setTimeout(() => setSyncResult(null), 5000)
      }
    }
  }

  // Custom reminder handlers
  const fetchReminders = useCallback(async () => {
    setRemindersLoading(true)
    try {
      const res = await fetch('/api/notifications/reminders')
      if (res.ok) {
        const data = await res.json()
        setReminders(data)
      }
    } catch {
      // Silently fail
    } finally {
      setRemindersLoading(false)
    }
  }, [])

  const fetchStorageData = useCallback(async () => {
    setStorageLoading(true)
    try {
      const res = await fetch('/api/storage')
      if (res.ok) {
        const data = await res.json()
        setStorageData(data)
      }
    } catch {
      // Silently fail
    } finally {
      setStorageLoading(false)
    }
  }, [])

  const handleCreateReminder = async () => {
    if (!newReminder.title || newReminder.days.length === 0) return
    try {
      const res = await fetch('/api/notifications/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newReminder.title,
          message: newReminder.message,
          time: newReminder.time,
          days: newReminder.days,
        }),
      })
      if (res.ok) {
        setShowAddReminder(false)
        setNewReminder({ title: '', message: '', time: '09:00', days: [1, 2, 3, 4, 5] })
        fetchReminders()
      }
    } catch {
      // Silently fail
    }
  }

  const handleToggleReminder = async (id: string, active: boolean) => {
    try {
      const res = await fetch('/api/notifications/reminders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active }),
      })
      if (res.ok) {
        setReminders(prev => prev.map(r => r.id === id ? { ...r, active } : r))
      }
    } catch {
      // Silently fail
    }
  }

  const handleDeleteReminder = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/reminders?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setReminders(prev => prev.filter(r => r.id !== id))
      }
    } catch {
      // Silently fail
    }
  }

  const exportOptions = [
    { type: 'finances', label: 'Finances', desc: 'Income, expenses & categories', icon: <Wallet className="h-4 w-4 text-red-600" /> },
    { type: 'journal', label: 'Journal', desc: 'Entries, moods & reflections', icon: <BookOpen className="h-4 w-4 text-rose-600" /> },
    { type: 'goals', label: 'Goals', desc: 'Goals, tasks & progress', icon: <Target className="h-4 w-4 text-red-600" /> },
    { type: 'memories', label: 'Memories', desc: 'Wins, patterns & insights', icon: <Brain className="h-4 w-4 text-red-700" /> },
    { type: 'scores', label: 'Scores', desc: 'Life area scores over time', icon: <BarChart3 className="h-4 w-4 text-red-600" /> },
    { type: 'checkins', label: 'Check-ins', desc: 'Morning & evening check-ins', icon: <ClipboardCheck className="h-4 w-4 text-red-600" /> },
    { type: 'all', label: 'All Data', desc: 'Complete export of everything', icon: <Database className="h-4 w-4 text-neutral-600" /> },
  ]

  const handleExport = async (type: string, format: 'csv' | 'json') => {
    try {
      setExportLoading(`${type}-${format}`)
      const res = await fetch(`/api/export?type=${type}&format=${format}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `myos-${type}-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExportLoading(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto w-[95vw] sm:w-auto rounded-t-2xl sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-600" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure your MyOS experience
          </DialogDescription>
        </DialogHeader>

        {settingsLoading && (
          <div className="flex items-center gap-2 text-xs text-neutral-500 py-1">
            <Loader2 className="h-3 w-3 animate-spin text-red-600" />
            Saving...
          </div>
        )}

        {/* Quick schedule status banner */}
        {localSettings && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
            <AlarmClock className="h-4 w-4 text-red-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">Check-in Schedule</p>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                Morning {localSettings.checkInWindows.morningEnabled ? `@ ${localSettings.checkInWindows.morningTime}` : '(off)'} &bull; Evening {localSettings.checkInWindows.eveningEnabled ? `@ ${localSettings.checkInWindows.eveningTime}` : '(off)'}{localSettings.checkInWindows.strictMode ? ' · Strict ON' : ''}
              </p>
            </div>
            <button onClick={() => setActiveTab('checkins')} className="text-[10px] text-red-600 hover:text-red-700 font-medium shrink-0">Edit</button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full overflow-x-auto scrollbar-hide flex sm:grid sm:grid-cols-6 h-auto gap-0 p-1 -mx-1 px-1 sm:mx-0 sm:px-0">
            <TabsTrigger value="checkins" className="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-2 sm:py-2.5 shrink-0 whitespace-nowrap data-[state=active]:shadow-[inset_0_-2px_0_0_rgba(220,38,38,1)] data-[state=active]:border-b-2 data-[state=active]:border-red-600">Check-ins</TabsTrigger>
            <TabsTrigger value="appearance" className="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-2 sm:py-2.5 shrink-0 whitespace-nowrap data-[state=active]:shadow-[inset_0_-2px_0_0_rgba(220,38,38,1)] data-[state=active]:border-b-2 data-[state=active]:border-red-600">Appearance</TabsTrigger>
            <TabsTrigger value="features" className="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-2 sm:py-2.5 shrink-0 whitespace-nowrap data-[state=active]:shadow-[inset_0_-2px_0_0_rgba(220,38,38,1)] data-[state=active]:border-b-2 data-[state=active]:border-red-600">Features</TabsTrigger>
            <TabsTrigger value="integrations" className="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-2 sm:py-2.5 shrink-0 whitespace-nowrap data-[state=active]:shadow-[inset_0_-2px_0_0_rgba(220,38,38,1)] data-[state=active]:border-b-2 data-[state=active]:border-red-600">Integrations</TabsTrigger>
            <TabsTrigger value="data" className="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-2 sm:py-2.5 shrink-0 whitespace-nowrap data-[state=active]:shadow-[inset_0_-2px_0_0_rgba(220,38,38,1)] data-[state=active]:border-b-2 data-[state=active]:border-red-600">Data</TabsTrigger>
            <TabsTrigger value="security" className="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-2 sm:py-2.5 shrink-0 whitespace-nowrap data-[state=active]:shadow-[inset_0_-2px_0_0_rgba(220,38,38,1)] data-[state=active]:border-b-2 data-[state=active]:border-red-600">Security</TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            {/* Check-in Windows Tab */}
            {activeTab === 'checkins' && (
              <TabsContent value="checkins" className="mt-4 space-y-4" forceMount>
                <motion.div
                  key="checkins-content"
                  variants={tabContentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-4"
                >
                  {/* Morning Check-in */}
                  <div className="space-y-3 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Morning Check-in</span>
                      </div>
                      <Switch
                        checked={localSettings.checkInWindows.morningEnabled}
                        onCheckedChange={(v) => updateCheckInWindow('morningEnabled', v)}
                      />
                    </div>
                    {localSettings.checkInWindows.morningEnabled && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="morning-time" className="text-xs text-neutral-500 w-20">Time</Label>
                          <Input
                            id="morning-time"
                            type="time"
                            value={localSettings.checkInWindows.morningTime}
                            onChange={(e) => updateCheckInWindow('morningTime', e.target.value)}
                            className="text-sm h-8"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Evening Check-in */}
                  <div className="space-y-3 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Evening Check-in</span>
                      </div>
                      <Switch
                        checked={localSettings.checkInWindows.eveningEnabled}
                        onCheckedChange={(v) => updateCheckInWindow('eveningEnabled', v)}
                      />
                    </div>
                    {localSettings.checkInWindows.eveningEnabled && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="evening-time" className="text-xs text-neutral-500 w-20">Time</Label>
                          <Input
                            id="evening-time"
                            type="time"
                            value={localSettings.checkInWindows.eveningTime}
                            onChange={(e) => updateCheckInWindow('eveningTime', e.target.value)}
                            className="text-sm h-8"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Strict Mode */}
                  <div className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div>
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Strict Mode</span>
                      </div>
                      <p className="text-xs leading-relaxed text-neutral-400 dark:text-neutral-500 mt-1">Only allow check-ins within the scheduled window</p>
                    </div>
                    <Switch
                      checked={localSettings.checkInWindows.strictMode}
                      onCheckedChange={(v) => updateCheckInWindow('strictMode', v)}
                    />
                  </div>

                  {/* Window Minutes */}
                  <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <Label className="text-xs text-neutral-500 dark:text-neutral-400">Check-in window (minutes before/after)</Label>
                    <Input
                      type="number"
                      min={5}
                      max={180}
                      value={localSettings.checkInWindows.windowMinutes}
                      onChange={(e) => updateCheckInWindow('windowMinutes', parseInt(e.target.value) || 60)}
                      className="text-sm h-8 mt-1"
                    />
                  </div>

                  {/* Browser Notifications */}
                  <div className="space-y-3 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Browser Notifications</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 sm:h-8 sm:text-sm"
                        onClick={handleRequestNotifications}
                        disabled={notificationPermission === 'denied'}
                      >
                        {notificationPermission === 'granted' ? '✓ Enabled' : notificationPermission === 'denied' ? 'Blocked' : 'Enable'}
                      </Button>
                    </div>
                    {notificationPermission === 'granted' && (
                      <div className="space-y-2 pl-6">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-600 dark:text-neutral-400">Morning reminder</span>
                          <Switch
                            checked={localSettings.morningReminderEnabled ?? true}
                            onCheckedChange={(v) => updateSetting('morningReminderEnabled', v)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-600 dark:text-neutral-400">Evening reminder</span>
                          <Switch
                            checked={localSettings.eveningReminderEnabled ?? true}
                            onCheckedChange={(v) => updateSetting('eveningReminderEnabled', v)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-600 dark:text-neutral-400">Drift alerts</span>
                          <Switch
                            checked={localSettings.driftAlertNotifications ?? true}
                            onCheckedChange={(v) => updateSetting('driftAlertNotifications', v)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-600 dark:text-neutral-400">Streak celebrations</span>
                          <Switch
                            checked={localSettings.streakNotifications ?? true}
                            onCheckedChange={(v) => updateSetting('streakNotifications', v)}
                          />
                        </div>
                      </div>
                    )}
                    {notificationPermission === 'denied' && (
                      <p className="text-xs text-rose-500 pl-6">Notifications blocked. Please enable in browser settings.</p>
                    )}
                  </div>

                  {/* Custom Reminders */}
                  <div className="space-y-3 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlarmClock className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Custom Reminders</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 sm:h-8 sm:text-sm"
                        onClick={() => setShowAddReminder(true)}
                        disabled={showAddReminder}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>

                    {/* Add Reminder Form */}
                    {showAddReminder && (
                      <div className="space-y-2.5 p-3 rounded-md bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-neutral-500 w-14 shrink-0">Title</Label>
                          <Input
                            value={newReminder.title}
                            onChange={(e) => setNewReminder(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="e.g., Review weekly goals"
                            className="text-sm h-8"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-neutral-500 w-14 shrink-0">Message</Label>
                          <Input
                            value={newReminder.message}
                            onChange={(e) => setNewReminder(prev => ({ ...prev, message: e.target.value }))}
                            placeholder="e.g., Take 10 minutes to review your goals"
                            className="text-sm h-8"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-neutral-500 w-14 shrink-0">Time</Label>
                          <Input
                            type="time"
                            value={newReminder.time}
                            onChange={(e) => setNewReminder(prev => ({ ...prev, time: e.target.value }))}
                            className="text-sm h-8"
                          />
                        </div>
                        <div className="flex items-start gap-2">
                          <Label className="text-xs text-neutral-500 w-14 shrink-0 mt-1">Days</Label>
                          <div className="flex flex-wrap gap-2">
                            {DAY_LABELS.map(day => (
                              <label key={day.value} className="flex items-center gap-1 cursor-pointer">
                                <Checkbox
                                  checked={newReminder.days.includes(day.value)}
                                  onCheckedChange={(checked) => {
                                    setNewReminder(prev => ({
                                      ...prev,
                                      days: checked
                                        ? [...prev.days, day.value]
                                        : prev.days.filter(d => d !== day.value),
                                    }))
                                  }}
                                />
                                <span className="text-xs text-neutral-600 dark:text-neutral-400">{day.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7 sm:h-8 sm:text-sm"
                            onClick={() => {
                              setShowAddReminder(false)
                              setNewReminder({ title: '', message: '', time: '09:00', days: [1, 2, 3, 4, 5] })
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="text-xs h-7 sm:h-8 sm:text-sm bg-red-600 hover:bg-red-700"
                            onClick={handleCreateReminder}
                            disabled={!newReminder.title || newReminder.days.length === 0}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Reminders List */}
                    {remindersLoading ? (
                      <div className="flex items-center justify-center py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                      </div>
                    ) : reminders.length === 0 && !showAddReminder ? (
                      <p className="text-xs text-neutral-400 pl-6">No custom reminders yet. Add one to get started.</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                        {reminders.map(reminder => {
                          const reminderDays = (() => {
                            try { return JSON.parse(reminder.days) as number[] } catch { return [] }
                          })()
                          return (
                            <div
                              key={reminder.id}
                              className={`flex items-center gap-2 p-2.5 rounded-md border border-neutral-200 dark:border-neutral-700 ${!reminder.active ? 'opacity-50' : ''}`}
                            >
                              <Switch
                                checked={reminder.active}
                                onCheckedChange={(checked) => handleToggleReminder(reminder.id, checked)}
                                className="scale-75"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{reminder.title}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-neutral-500 whitespace-nowrap">{reminder.time}</span>
                                  <span className="text-[10px] text-neutral-400">
                                    {reminderDays.map(d => DAY_LABELS.find(l => l.value === d)?.label).filter(Boolean).join(', ')}
                                  </span>
                                </div>
                                {reminder.message && (
                                  <p className="text-[10px] text-neutral-400 truncate mt-0.5">{reminder.message}</p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-neutral-400 hover:text-rose-500 sm:h-8 sm:w-8"
                                onClick={() => handleDeleteReminder(reminder.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              </TabsContent>
            )}

            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
              <TabsContent value="appearance" className="mt-4 space-y-4" forceMount>
                <motion.div
                  key="appearance-content"
                  variants={tabContentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-4"
                >
                  <div className="space-y-3 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Sun className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Theme</span>
                    </div>
                    <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400 mb-3">Choose how MyOS looks. System follows your device settings.</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          setTheme('light')
                          updateSetting('darkMode', false)
                        }}
                        className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                          theme === 'light'
                            ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                            : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                        }`}
                      >
                        <Sun className={`h-5 w-5 ${theme === 'light' ? 'text-red-600' : 'text-neutral-400'}`} />
                        <span className={`text-xs font-medium ${theme === 'light' ? 'text-red-700 dark:text-red-400' : 'text-neutral-600 dark:text-neutral-400'}`}>Light</span>
                      </button>
                      <button
                        onClick={() => {
                          setTheme('dark')
                          updateSetting('darkMode', true)
                        }}
                        className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                          theme === 'dark'
                            ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                            : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                        }`}
                      >
                        <Moon className={`h-5 w-5 ${theme === 'dark' ? 'text-red-600' : 'text-neutral-400'}`} />
                        <span className={`text-xs font-medium ${theme === 'dark' ? 'text-red-700 dark:text-red-400' : 'text-neutral-600 dark:text-neutral-400'}`}>Dark</span>
                      </button>
                      <button
                        onClick={() => {
                          setTheme('system')
                          updateSetting('darkMode', false)
                        }}
                        className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                          theme === 'system'
                            ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                            : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                        }`}
                      >
                        <Monitor className={`h-5 w-5 ${theme === 'system' ? 'text-red-600' : 'text-neutral-400'}`} />
                        <span className={`text-xs font-medium ${theme === 'system' ? 'text-red-700 dark:text-red-400' : 'text-neutral-600 dark:text-neutral-400'}`}>System</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              </TabsContent>
            )}

            {/* Features Tab */}
            {activeTab === 'features' && (
              <TabsContent value="features" className="mt-4 space-y-4" forceMount>
                <motion.div
                  key="features-content"
                  variants={tabContentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Notifications</span>
                    </div>
                    <Switch
                      checked={localSettings.notificationsEnabled}
                      onCheckedChange={(v) => updateSetting('notificationsEnabled', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center gap-2">
                      <Mic className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Voice Notes</span>
                    </div>
                    <Switch
                      checked={localSettings.voiceNotesEnabled}
                      onCheckedChange={(v) => updateSetting('voiceNotesEnabled', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Image Upload</span>
                    </div>
                    <Switch
                      checked={localSettings.imageUploadEnabled}
                      onCheckedChange={(v) => updateSetting('imageUploadEnabled', v)}
                    />
                  </div>
                </motion.div>
              </TabsContent>
            )}

            {/* Integrations Tab */}
            {activeTab === 'integrations' && (
              <TabsContent value="integrations" className="mt-4 space-y-4" forceMount>
                <motion.div
                  key="integrations-content"
                  variants={tabContentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-4"
                >
                  {/* Google Connection Status */}
                  <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Google Calendar</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {googleEnvConfigured === false && !googleConnected && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 text-rose-600 border-rose-300 dark:border-rose-700 dark:text-rose-400">
                            Env vars not set
                          </Badge>
                        )}
                        {googleConnected ? (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] px-2 py-0.5">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-neutral-500 dark:border-neutral-600 dark:text-neutral-400">
                            Disconnected
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Success message from OAuth callback */}
                    {googleSuccess && (
                      <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 mb-3 p-2 rounded-md bg-red-50 dark:bg-red-900/20">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        <span>{googleSuccess}</span>
                      </div>
                    )}

                    {/* Error message */}
                    {googleError && (
                      <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 mb-3 p-2 rounded-md bg-red-50 dark:bg-red-900/20">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{googleError}</span>
                      </div>
                    )}

                    {/* Env vars status indicator */}
                    {googleEnvConfigured === null && !googleConnected && (
                      <div className="flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500 mb-3">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Checking Google configuration...
                      </div>
                    )}

                    {googleConnected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 sm:h-8 sm:text-sm gap-1.5 w-full text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                        onClick={handleDisconnectGoogle}
                      >
                        <Unlink className="h-3.5 w-3.5" />
                        Disconnect Google
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          className="text-xs h-7 sm:h-8 sm:text-sm gap-1.5 w-full bg-red-600 hover:bg-red-700 text-white"
                          onClick={handleConnectGoogle}
                          disabled={googleConnectLoading || googleEnvConfigured === false}
                        >
                          {googleConnectLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Link2 className="h-3.5 w-3.5" />
                          )}
                          Connect Google
                        </Button>
                        {googleEnvConfigured === false && (
                          <p className="text-[10px] text-red-500 dark:text-red-400 mt-2 leading-tight">
                            Google OAuth is not configured. Set <code className="px-1 py-0.5 bg-red-50 dark:bg-red-900/30 rounded text-[9px] font-mono">GOOGLE_CLIENT_ID</code> and <code className="px-1 py-0.5 bg-red-50 dark:bg-red-900/30 rounded text-[9px] font-mono">GOOGLE_CLIENT_SECRET</code> environment variables to enable Google integration.
                          </p>
                        )}
                        {googleEnvConfigured === true && (
                          <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-2 leading-tight">
                            Make sure <code className="px-1 py-0.5 bg-rose-50 dark:bg-rose-900/30 rounded text-[9px] font-mono break-all">{typeof window !== 'undefined' ? `${window.location.origin}/api/google/callback` : 'https://your-domain.com/api/google/callback'}</code> is added as an <strong>Authorized redirect URI</strong> in your Google Cloud Console OAuth settings.
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Auto-create Calendar Reminders Toggle */}
                  <div className="space-y-3 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 text-red-500" />
                          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Auto-create calendar reminders</span>
                        </div>
                        <p className="text-xs leading-relaxed text-neutral-400 dark:text-neutral-500 mt-1">
                          Create recurring Google Calendar events with reminders for each check-in window
                        </p>
                      </div>
                      <Switch
                        checked={localSettings.googleCalendarEnabled}
                        onCheckedChange={handleSyncCalendarReminders}
                        disabled={!googleConnected || syncLoading}
                      />
                    </div>
                    {syncLoading && (
                      <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 pl-6">
                        <Loader2 className="h-3 w-3 animate-spin text-red-600" />
                        Syncing check-in events to Google Calendar...
                      </div>
                    )}
                    {syncResult && (
                      <div className={`flex items-center gap-2 text-xs pl-6 ${syncResult.success ? 'text-red-600 dark:text-red-400' : 'text-red-800 dark:text-red-300'}`}>
                        {syncResult.success ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        {syncResult.message}
                      </div>
                    )}
                    {!googleConnected && (
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 pl-6">Connect Google first to enable calendar sync</p>
                    )}
                  </div>

                  {/* Email Reminders Toggle */}
                  <div className="space-y-3 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-red-500" />
                          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Email reminders for check-ins</span>
                        </div>
                        <p className="text-xs leading-relaxed text-neutral-400 dark:text-neutral-500 mt-1">
                          Send email notifications before each check-in window via Gmail
                        </p>
                      </div>
                      <Switch
                        checked={localSettings.googleEmailReminders}
                        onCheckedChange={(v) => updateSetting('googleEmailReminders', v)}
                        disabled={!googleConnected}
                      />
                    </div>
                    {!googleConnected && (
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 pl-6">Connect Google first to enable email reminders</p>
                    )}
                  </div>

                  {/* Reminder Email Address */}
                  <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <Label htmlFor="reminder-email" className="text-xs text-neutral-500 dark:text-neutral-400">
                      Reminder email address
                    </Label>
                    <Input
                      id="reminder-email"
                      type="email"
                      placeholder="your@email.com"
                      value={localSettings.googleReminderEmail || ''}
                      onChange={(e) => updateSetting('googleReminderEmail', e.target.value)}
                      className="text-sm h-8 mt-1"
                      disabled={!googleConnected}
                    />
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
                      Where to send check-in reminder emails
                    </p>
                  </div>

                  {/* Voice Transcription */}
                  <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Key className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Voice Transcription</span>
                    </div>
                    <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400 mb-2">
                      Voice notes are transcribed using the built-in AI speech recognition engine. Works automatically with no additional setup required.
                    </p>
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                        <strong>Primary:</strong> AI-powered transcription for high accuracy across all browsers.
                      </p>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                        <strong>Fallback:</strong> Browser&apos;s built-in speech recognition (Chrome/Edge only, less accurate).
                      </p>
                    </div>
                  </div>
                </motion.div>
              </TabsContent>
            )}

            {/* Data Export Tab */}
            {activeTab === 'data' && (
              <TabsContent value="data" className="mt-4 space-y-4" forceMount>
                <motion.div
                  key="data-content"
                  variants={tabContentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-4"
                >
                  {/* Storage Overview */}
                  <Card className="shadow-sm border-red-100 dark:border-red-900/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-red-600" />
                          <h3 className="text-sm font-semibold">Storage Overview</h3>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={fetchStorageData}
                          disabled={storageLoading}
                        >
                          {storageLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        </Button>
                      </div>

                      {storageData ? (
                        <>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
                              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Total Records</p>
                              <p className="text-xl font-bold text-red-700 dark:text-red-400">{storageData.totalRecords.toLocaleString()}</p>
                            </div>
                            <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
                              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Database Size</p>
                              <p className="text-xl font-bold text-red-700 dark:text-red-400">{storageData.dbSizeFormatted}</p>
                            </div>
                          </div>

                          <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-3 mb-3">
                            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">Storage Type</p>
                            <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{storageData.storageInfo.type}</p>
                          </div>

                          <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400 mb-2">
                            {storageData.storageInfo.description}
                          </p>
                          <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-lg p-3">
                            <p className="text-xs leading-relaxed text-red-700 dark:text-red-300 font-medium">
                              {storageData.storageInfo.recommendation}
                            </p>
                          </div>

                          {/* Breakdown by table */}
                          <div className="mt-3 max-h-48 overflow-y-auto">
                            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">Records by Category</p>
                            <div className="space-y-1">
                              {storageData.tables.filter(t => t.count > 0).map(table => (
                                <div key={table.name} className="flex items-center justify-between text-xs">
                                  <span className="text-neutral-600 dark:text-neutral-400">{table.name}</span>
                                  <span className="font-medium text-neutral-700 dark:text-neutral-300">{table.count.toLocaleString()}</span>
                                </div>
                              ))}
                              {storageData.tables.filter(t => t.count > 0).length === 0 && (
                                <p className="text-xs text-neutral-400 italic">No records yet</p>
                              )}
                            </div>
                          </div>
                        </>
                      ) : storageLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-5 w-5 animate-spin text-red-600" />
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-400">Unable to load storage data.</p>
                      )}
                    </CardContent>
                  </Card>

                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Download className="h-4 w-4 text-red-600" />
                      Download Your Data
                    </h3>
                    <p className="text-xs leading-relaxed text-neutral-500 mt-1">
                      Export your data as CSV or JSON files. Your data stays yours.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {exportOptions.map(opt => (
                      <Card key={opt.type} className="shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                              {opt.icon}
                            </div>
                            <div>
                              <h4 className="text-sm font-medium">{opt.label}</h4>
                              <p className="text-[10px] text-neutral-400">{opt.desc}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 sm:h-8 sm:text-sm flex-1"
                              disabled={exportLoading === `${opt.type}-csv`}
                              onClick={() => handleExport(opt.type, 'csv')}
                            >
                              {exportLoading === `${opt.type}-csv` ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                              CSV
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 sm:h-8 sm:text-sm flex-1"
                              disabled={exportLoading === `${opt.type}-json`}
                              onClick={() => handleExport(opt.type, 'json')}
                            >
                              {exportLoading === `${opt.type}-json` ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                              JSON
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* ─── DANGER ZONE ─── */}
                  <div className="mt-6 pt-6 border-t border-red-200 dark:border-red-900/40">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-red-600 dark:text-red-400">
                      <Trash2 className="h-4 w-4" />
                      Danger Zone
                    </h3>
                    <p className="text-xs leading-relaxed text-neutral-500 mt-1 mb-4">
                      Permanently delete all your data. This action cannot be undone. You will need to set up your OS again from scratch.
                    </p>
                    <DangerZoneSection />
                  </div>
                </motion.div>
              </TabsContent>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <TabsContent value="security" className="mt-4" forceMount>
                <motion.div
                  key="security-content"
                  variants={tabContentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                    {success ? (
                      <div className="flex flex-col items-center py-6 gap-3">
                        <CheckCircle2 className="h-12 w-12 text-red-500" />
                        <p className="text-sm font-medium text-red-700">Access code updated successfully</p>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="current-code">Current Access Code</Label>
                          <Input
                            id="current-code"
                            type="password"
                            placeholder="Enter current code"
                            value={currentCode}
                            onChange={(e) => { setCurrentCode(e.target.value); setError('') }}
                            autoFocus
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-code">New Access Code</Label>
                          <Input
                            id="new-code"
                            type="password"
                            placeholder="Enter new code (min 4 characters)"
                            value={newCode}
                            onChange={(e) => { setNewCode(e.target.value); setError('') }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirm-code">Confirm New Access Code</Label>
                          <Input
                            id="confirm-code"
                            type="password"
                            placeholder="Re-enter new code"
                            value={confirmCode}
                            onChange={(e) => { setConfirmCode(e.target.value); setError('') }}
                          />
                        </div>
                        {error && (
                          <div className="flex items-center gap-2 text-red-600 text-sm">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{error}</span>
                          </div>
                        )}
                        <DialogFooter>
                          <Button
                            type="submit"
                            disabled={loading || !currentCode || !newCode || !confirmCode}
                            className="bg-red-600 hover:bg-red-700 text-white h-7 sm:h-8 text-xs sm:text-sm"
                          >
                            {loading ? (
                              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Updating...</>
                            ) : 'Update Code'}
                          </Button>
                        </DialogFooter>
                      </form>
                    )}
                </motion.div>
              </TabsContent>
            )}
          </AnimatePresence>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
