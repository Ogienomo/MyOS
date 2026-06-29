'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useAppStore, DashboardData } from '@/lib/store'
import { AuthGate } from '@/components/praise-os/auth-gate'
import { Sidebar } from '@/components/praise-os/sidebar'
import { Settings } from '@/components/praise-os/settings'
import { Dashboard } from '@/components/praise-os/dashboard'
import { Chat } from '@/components/praise-os/chat'
import { Goals } from '@/components/praise-os/goals'
import { Finances } from '@/components/praise-os/finances'
import { Insights } from '@/components/praise-os/insights'
import { Calendar } from '@/components/praise-os/calendar'
import { LifeTab } from '@/components/praise-os/life-tab'
import { MoreTab } from '@/components/praise-os/more-tab'
import { Journal } from '@/components/praise-os/journal'
import { Habits } from '@/components/praise-os/habits'
import { WeeklyReview } from '@/components/praise-os/weekly-review'
import { MoodLog } from '@/components/praise-os/mood-log'
import { ErrorBoundary } from '@/components/praise-os/error-boundary'
import { Heart, Loader2 } from 'lucide-react'
import { SearchDialog, SearchTrigger } from '@/components/praise-os/search-dialog'
import { NotificationManager } from '@/components/praise-os/notification-manager'
import { OnboardingTour } from '@/components/praise-os/onboarding-tour'
import { SwipeHandler } from '@/components/praise-os/swipe-handler'
import { CelebrationOverlay } from '@/components/praise-os/celebrations'
import { DarkModeSync } from '@/components/praise-os/dark-mode-sync'
import { QuickActions } from '@/components/praise-os/quick-actions'
import { VoiceMode } from '@/components/praise-os/voice-mode'
import { AnimatePresence, motion } from 'framer-motion'

const About = dynamic(() => import('@/components/praise-os/about').then(m => ({ default: m.About })), { loading: () => <Loading /> })
const FaithPage = dynamic(() => import('@/components/praise-os/life-areas/faith-page').then(m => ({ default: m.FaithPage })), { loading: () => <Loading /> })
const HealthPage = dynamic(() => import('@/components/praise-os/life-areas/health-page').then(m => ({ default: m.HealthPage })), { loading: () => <Loading /> })
const CareerPage = dynamic(() => import('@/components/praise-os/life-areas/career-page').then(m => ({ default: m.CareerPage })), { loading: () => <Loading /> })
const HavilahPage = dynamic(() => import('@/components/praise-os/life-areas/havilah-page').then(m => ({ default: m.HavilahPage })), { loading: () => <Loading /> })
const FinancesPage = dynamic(() => import('@/components/praise-os/life-areas/finances-page').then(m => ({ default: m.FinancesPage })), { loading: () => <Loading /> })
const RelationshipsPage = dynamic(() => import('@/components/praise-os/life-areas/relationships-page').then(m => ({ default: m.RelationshipsPage })), { loading: () => <Loading /> })
const PersonalGrowthPage = dynamic(() => import('@/components/praise-os/life-areas/personal-growth-page').then(m => ({ default: m.PersonalGrowthPage })), { loading: () => <Loading /> })

function Loading() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-red-600" />
    </div>
  )
}

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

function AppContent() {
  const { activeTab, setDashboardData, setDashboardLoading } = useAppStore()

  // ─── Chat reset key ────
  // When the ErrorBoundary's "Try Again" fires (or any other code dispatches
  // `myos-reset-chat`), we bump this key so <Chat /> fully remounts —
  // clearing all its local React state (streaming refs/flags, input, etc.)
  // without touching the persisted Zustand store.
  const [chatResetKey, setChatResetKey] = useState(0)
  useEffect(() => {
    const handler = () => setChatResetKey(k => k + 1)
    if (typeof window !== 'undefined') {
      window.addEventListener('myos-reset-chat', handler)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('myos-reset-chat', handler)
      }
    }
  }, [])

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch('/api/dashboard')
        const data = await res.json()
        setDashboardData(data as DashboardData)
      } catch (err) {
        console.error('Failed to fetch dashboard:', err)
      } finally {
        setDashboardLoading(false)
      }
    }
    fetchDashboard()
  }, [setDashboardData, setDashboardLoading])

  return renderTab(activeTab, chatResetKey)
}

function renderTab(tab: string, chatResetKey: number = 0) {
  switch (tab) {
    case 'dashboard': return <Dashboard />
    case 'chat': return <ErrorBoundary><Chat key={chatResetKey} /></ErrorBoundary>
    case 'life': return <LifeTab />
    case 'goals': return <Goals />
    case 'finances': return <Finances />
    case 'insights': return <Insights />
    case 'calendar': return <Calendar />
    case 'about': return <About />
    case 'more': return <MoreTab />
    case 'faith': return <FaithPage />
    case 'health': return <HealthPage />
    case 'career': return <CareerPage />
    case 'havilah': return <HavilahPage />
    case 'relationships': return <RelationshipsPage />
    case 'personalGrowth': return <PersonalGrowthPage />
    case 'journal': return <Journal />
    case 'habits': return <Habits />
    case 'weeklyReview': return <WeeklyReview />
    case 'moodLog': return <ErrorBoundary><MoodLog /></ErrorBoundary>
    default: return <Dashboard />
  }
}

export default function MyOSApp() {
  const { isAuthenticated, activeTab, settingsOpen, setSettingsOpen, osName, businessName, businessDescription } = useAppStore()

  // Sync business name/description to localStorage for dynamic area labels
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (businessName) {
      localStorage.setItem('myos-business-name', businessName)
    } else {
      localStorage.removeItem('myos-business-name')
    }
    if (businessDescription) {
      localStorage.setItem('myos-business-description', businessDescription)
    } else {
      localStorage.removeItem('myos-business-description')
    }
  }, [businessName, businessDescription])

  // Handle OAuth callback redirect params - open Settings to show the result
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('google_connected') || params.get('google_error')) {
      // Open settings dialog so user sees the feedback
      setSettingsOpen(true)
    }
  }, [setSettingsOpen])

  // Scroll to top on tab change (except chat, which manages its own scroll)
  useEffect(() => {
    if (activeTab !== 'chat') {
      window.scrollTo(0, 0)
    }
  }, [activeTab])

  if (!isAuthenticated) {
    return <AuthGate />
  }

  const isChatTab = activeTab === 'chat'

  return (
    <div className="min-h-screen bg-background flex flex-col [overflow-x:clip]">
      <DarkModeSync />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 md:ml-64 min-w-0 overflow-x-hidden">
          <AnimatePresence mode="wait">
            {isChatTab ? (
              <motion.div
                key="chat-layout"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="h-[calc(100vh-56px)] md:h-screen overflow-hidden"
              >
                <AppContent />
              </motion.div>
            ) : (
              <motion.div
                key="standard-layout"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="max-w-4xl mx-auto px-3 md:px-4 pt-14 md:pt-6 py-6 pb-28 md:pb-6"
              >
                {/* Search trigger bar */}
                <div className="mb-4 flex justify-end">
                  <SearchTrigger onClick={() => window.dispatchEvent(new CustomEvent('open-search'))} />
                </div>
                <AppContent />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
      <footer className="hidden md:block md:ml-64 bg-black text-white py-3 px-6 mt-auto">
        <p className="text-[10px] text-neutral-400 flex items-center justify-center gap-1">
          <Heart className="h-3 w-3 text-red-500" />
          {osName} &bull; Life Operating System &bull; Aligned &bull; Disciplined &bull; Joyful
        </p>
      </footer>
      <NotificationManager />
      <Settings open={settingsOpen} onOpenChange={setSettingsOpen} />
      <SearchDialog />
      <OnboardingTour />
      <SwipeHandler />
      <CelebrationOverlay />
      {activeTab !== 'chat' && <QuickActions />}
      <VoiceMode />
    </div>
  )
}
