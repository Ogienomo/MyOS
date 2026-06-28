'use client'

import { useState, useEffect } from 'react'
import { useAppStore, TabId } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Settings, Info, BookOpen, Wallet, Calendar, Lightbulb,
  ChevronRight, Shield, Bell, Volume2, ImageIcon, Moon, Lock,
  Sparkles, Heart, Repeat, Database, BellRing, BellOff,
} from 'lucide-react'
import { BackupRestore } from './backup-restore'

const sections: { id: TabId; label: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'habits', label: 'Habits', desc: 'Track recurring goals & streaks', icon: <Repeat className="h-5 w-5 text-red-500" /> },
  { id: 'moodLog', label: 'Mood Log', desc: 'Track how you feel, energy, focus', icon: <Heart className="h-5 w-5 text-red-500" /> },
  { id: 'about', label: 'About', desc: 'About your Life Operating System', icon: <Info className="h-5 w-5 text-red-500" /> },
  { id: 'insights', label: 'Insights & Patterns', desc: 'Drift detection, memory, patterns', icon: <Lightbulb className="h-5 w-5 text-red-500" /> },
  { id: 'finances', label: 'Finances', desc: 'Track every naira', icon: <Wallet className="h-5 w-5 text-red-500" /> },
  { id: 'calendar', label: 'Calendar & Cadence', desc: 'Your daily rhythm', icon: <Calendar className="h-5 w-5 text-red-500" /> },
]

type NotifPermission = 'default' | 'granted' | 'denied' | 'unsupported'

export function MoreTab() {
  const { setActiveTab, setSettingsOpen } = useAppStore()
  const [notifPermission, setNotifPermission] = useState<NotifPermission>('default')
  const [requestingNotif, setRequestingNotif] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotifPermission('unsupported')
    } else {
      setNotifPermission(Notification.permission as NotifPermission)
    }
  }, [])

  const requestNotifications = async () => {
    if (!('Notification' in window)) return
    setRequestingNotif(true)
    try {
      const permission = await Notification.requestPermission()
      setNotifPermission(permission as NotifPermission)
      if (permission === 'granted') {
        new Notification('MyOS', {
          body: 'Notifications enabled! You\'ll get reminders for check-ins and streaks.',
          icon: '/icon-192.png',
        })
      }
    } finally {
      setRequestingNotif(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">More</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Settings, tools, and data</p>
      </div>

      {/* Settings Card */}
      <Card className="shadow-sm border-neutral-200 dark:border-neutral-700 cursor-pointer hover:border-red-200 dark:hover:border-red-800 transition-colors" onClick={() => setSettingsOpen(true)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
              <Settings className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Settings</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Password, check-in times, notifications</p>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-300" />
          </div>
        </CardContent>
      </Card>

      {/* Push Notifications */}
      {notifPermission !== 'unsupported' && (
        <Card className="shadow-sm border-neutral-200 dark:border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
                {notifPermission === 'granted'
                  ? <BellRing className="h-5 w-5 text-amber-600" />
                  : <Bell className="h-5 w-5 text-amber-600" />
                }
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Browser Notifications</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {notifPermission === 'granted'
                    ? 'Enabled — you\'ll receive check-in reminders'
                    : notifPermission === 'denied'
                    ? 'Blocked — enable in your browser settings'
                    : 'Enable to receive check-in reminders'}
                </p>
              </div>
              {notifPermission === 'default' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs shrink-0"
                  onClick={requestNotifications}
                  disabled={requestingNotif}
                >
                  Enable
                </Button>
              )}
              {notifPermission === 'granted' && (
                <span className="text-xs text-green-600 dark:text-green-400 font-medium shrink-0">Active</span>
              )}
              {notifPermission === 'denied' && (
                <BellOff className="h-4 w-4 text-neutral-300 shrink-0" />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Settings Preview */}
      <Card className="shadow-sm border-neutral-200 dark:border-neutral-700">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Volume2 className="h-4 w-4 text-red-500" />
            <span className="text-xs text-neutral-700 dark:text-neutral-300">Voice Notes</span>
            <span className="text-xs text-neutral-400 ml-auto">Enabled</span>
          </div>
          <div className="flex items-center gap-3">
            <ImageIcon className="h-4 w-4 text-red-500" />
            <span className="text-xs text-neutral-700 dark:text-neutral-300">Image Upload</span>
            <span className="text-xs text-neutral-400 ml-auto">Enabled</span>
          </div>
          <div className="flex items-center gap-3">
            <Lock className="h-4 w-4 text-red-500" />
            <span className="text-xs text-neutral-700 dark:text-neutral-300">Access Code</span>
            <span className="text-xs text-neutral-400 ml-auto">Change in Settings</span>
          </div>
        </CardContent>
      </Card>

      {/* Backup & Restore */}
      <BackupRestore />

      {/* Other Sections */}
      <div className="space-y-2">
        {sections.map((section) => (
          <Card key={section.id} className="shadow-sm border-neutral-200 dark:border-neutral-700 cursor-pointer hover:border-red-200 dark:hover:border-red-800 transition-colors" onClick={() => setActiveTab(section.id)}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center">
                  {section.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{section.label}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{section.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-300" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-[10px] text-neutral-400 flex items-center justify-center gap-1">
          <Heart className="h-3 w-3 text-red-500" />
          MyOS &bull; v2.1 &bull; Built with intention
        </p>
      </div>
    </div>
  )
}
