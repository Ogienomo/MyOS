'use client'

import { useState } from 'react'
import { useAppStore, TabId } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  LayoutDashboard,
  MessageCircle,
  Target,
  Calendar,
  Sparkles,
  Heart,
  Dumbbell,
  Briefcase,
  Gem,
  Users,
  Sprout,
  Wallet,
  Info,
  Settings,
  LogOut,
  Menu,
  MoreHorizontal,
  Flame,
  BookOpen,
  Repeat,
  CalendarCheck,
} from 'lucide-react'
import { motion } from 'framer-motion'

const mainNavItems: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { id: 'chat', label: 'AI Coach', icon: <MessageCircle className="h-5 w-5" /> },
  { id: 'life', label: 'Life', icon: <Flame className="h-5 w-5" /> },
  { id: 'goals', label: 'Goals', icon: <Target className="h-5 w-5" /> },
  { id: 'calendar', label: 'Calendar', icon: <Calendar className="h-5 w-5" /> },
]

const lifeAreaItems: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'faith', label: 'Faith', icon: <Heart className="h-5 w-5" /> },
  { id: 'health', label: 'Health', icon: <Dumbbell className="h-5 w-5" /> },
  { id: 'career', label: 'Career', icon: <Briefcase className="h-5 w-5" /> },
  { id: 'havilah', label: 'Havilah', icon: <Gem className="h-5 w-5" /> },
  { id: 'finances', label: 'Finances', icon: <Wallet className="h-5 w-5" /> },
  { id: 'relationships', label: 'Relationships', icon: <Users className="h-5 w-5" /> },
  { id: 'personalGrowth', label: 'Growth', icon: <Sprout className="h-5 w-5" /> },
]

const mobileNavItems: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Home', icon: <LayoutDashboard className="h-5 w-5" /> },
  { id: 'chat', label: 'Coach', icon: <MessageCircle className="h-5 w-5" /> },
  { id: 'life', label: 'Life', icon: <Flame className="h-5 w-5" /> },
  { id: 'goals', label: 'Goals', icon: <Target className="h-5 w-5" /> },
  { id: 'more', label: 'More', icon: <MoreHorizontal className="h-5 w-5" /> },
]

export function Sidebar() {
  const { activeTab, setActiveTab, setIsAuthenticated, setSettingsOpen, osName } = useAppStore()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem('myos-auth')
    setIsAuthenticated(false)
  }

  // Navigate and close the mobile drawer
  const handleNavigate = (id: TabId) => {
    setActiveTab(id)
    setMobileOpen(false)
  }

  const handleOpenSettings = () => {
    setSettingsOpen(true)
    setMobileOpen(false)
  }

  const handleLock = () => {
    setMobileOpen(false)
    handleLogout()
  }

  return (
    <>
      {/* Mobile Hamburger Button (fixed top-left, always accessible on mobile).
          Refined: elegant icon button with subtle accent glow + animated bars.
          Wrapped in a small "pill" with a faint hint label so users discover it. */}
      <div className="md:hidden fixed top-3 left-3 z-[60] flex items-center">
        <button
          type="button"
          aria-label="Open navigation menu"
          onClick={() => setMobileOpen(true)}
          className="group relative flex h-11 w-11 items-center justify-center rounded-2xl bg-black/85 text-white shadow-xl shadow-black/40 border border-neutral-800 backdrop-blur-md active:scale-95 transition-all duration-300 hover:border-red-600/40"
        >
          {/* Subtle red glow on hover */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ boxShadow: '0 0 18px 2px rgba(239, 68, 68, 0.25)' }}
          />
          <Menu className="h-[18px] w-[18px] transition-transform duration-300 group-hover:scale-105" />
        </button>
        {/* Discoverability hint — a tiny pulsing dot that fades after first tap */}
        <span
          aria-hidden="true"
          className="ml-1.5 h-1.5 w-1.5 rounded-full bg-red-500 animate-slow-pulse"
          title="Tap to open menu"
        />
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-black text-white overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-neutral-800 shrink-0">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-600/20 border border-red-600/30">
            <Sparkles className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">{osName}</h1>
            <p className="text-xs text-neutral-500">Life Operating System</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          <div>
            <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider px-3 mb-2.5">Main</p>
            <div className="space-y-1">
              {mainNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300',
                    activeTab === item.id
                      ? 'bg-red-600/15 text-red-400 border border-red-600/20 animate-color-sweep'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent'
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider px-3 mb-2.5">Life Areas</p>
            <div className="space-y-1">
              {lifeAreaItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300',
                    activeTab === item.id
                      ? 'bg-red-600/15 text-red-400 border border-red-600/20 animate-color-sweep'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent'
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          {/* Tools */}
          <div>
            <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider px-3 mb-2.5">Tools</p>
            <div className="space-y-1">
              <button
                onClick={() => setActiveTab('about')}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300',
                  activeTab === 'about'
                    ? 'bg-red-600/15 text-red-400 border border-red-600/20 animate-color-sweep'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent'
                )}
              >
                <Info className="h-5 w-5" />
                About
              </button>
              <button
                onClick={() => setActiveTab('journal')}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300',
                  activeTab === 'journal'
                    ? 'bg-red-600/15 text-red-400 border border-red-600/20 animate-color-sweep'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent'
                )}
              >
                <BookOpen className="h-5 w-5" />
                Journal
              </button>
              <button
                onClick={() => setActiveTab('habits')}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300',
                  activeTab === 'habits'
                    ? 'bg-red-600/15 text-red-400 border border-red-600/20 animate-color-sweep'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent'
                )}
              >
                <Repeat className="h-5 w-5" />
                Habits
              </button>
              <button
                onClick={() => setActiveTab('weeklyReview')}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300',
                  activeTab === 'weeklyReview'
                    ? 'bg-red-600/15 text-red-400 border border-red-600/20 animate-color-sweep'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent'
                )}
              >
                <CalendarCheck className="h-5 w-5" />
                Weekly Review
              </button>
            </div>
          </div>
        </nav>

        {/* Footer with Settings & Logout */}
        <div className="px-3 py-4 border-t border-neutral-800 shrink-0 space-y-1">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all duration-300 border border-transparent"
          >
            <Settings className="h-5 w-5" />
            Settings
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-all duration-300 border border-transparent"
          >
            <LogOut className="h-5 w-5" />
            Lock
          </button>
          <div className="px-3 pt-3">
            <p className="text-xs text-neutral-600">{osName} — Life OS</p>
            <p className="text-xs text-neutral-700 mt-1">Aligned &bull; Disciplined &bull; Joyful</p>
          </div>
        </div>
      </aside>

      {/* Mobile Slide-out Drawer (full navigation) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[85vw] max-w-xs p-0 bg-black text-white border-r border-neutral-800 flex flex-col data-[state=open]:duration-500"
        >
          <SheetHeader className="px-6 py-5 border-b border-neutral-800 shrink-0 space-y-0">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-red-600/20 border border-red-600/30 overflow-hidden animate-color-sweep">
                <Sparkles className="h-5 w-5 text-red-400 relative z-10" />
              </div>
              <div>
                <SheetTitle className="text-lg font-bold tracking-tight text-white">
                  {osName}
                </SheetTitle>
                <SheetDescription className="text-xs text-neutral-500">
                  Life Operating System
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Navigation (mirrors desktop sidebar) — refined for mobile:
              generous 44px touch targets, left-border active accent,
              staggered fade-in for a premium feel. */}
          <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
            <div>
              <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider px-3 mb-2.5">Main</p>
              <div className="space-y-1 animate-slow-fade-in-stagger">
                {mainNavItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-3 min-h-[44px] rounded-lg text-sm font-medium transition-all duration-300',
                      activeTab === item.id
                        ? 'bg-red-600/10 text-red-400 border border-transparent border-l-2 border-l-red-500'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent border-l-2 border-l-transparent'
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider px-3 mb-2.5">Life Areas</p>
              <div className="space-y-1 animate-slow-fade-in-stagger">
                {lifeAreaItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-3 min-h-[44px] rounded-lg text-sm font-medium transition-all duration-300',
                      activeTab === item.id
                        ? 'bg-red-600/10 text-red-400 border border-transparent border-l-2 border-l-red-500'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent border-l-2 border-l-transparent'
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider px-3 mb-2.5">Tools</p>
              <div className="space-y-1 animate-slow-fade-in-stagger">
                <button
                  onClick={() => handleNavigate('about')}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-3 min-h-[44px] rounded-lg text-sm font-medium transition-all duration-300',
                    activeTab === 'about'
                      ? 'bg-red-600/10 text-red-400 border border-transparent border-l-2 border-l-red-500'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent border-l-2 border-l-transparent'
                  )}
                >
                  <Info className="h-5 w-5" />
                  About
                </button>
                <button
                  onClick={() => handleNavigate('journal')}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-3 min-h-[44px] rounded-lg text-sm font-medium transition-all duration-300',
                    activeTab === 'journal'
                      ? 'bg-red-600/10 text-red-400 border border-transparent border-l-2 border-l-red-500'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent border-l-2 border-l-transparent'
                  )}
                >
                  <BookOpen className="h-5 w-5" />
                  Journal
                </button>
                <button
                  onClick={() => handleNavigate('habits')}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-3 min-h-[44px] rounded-lg text-sm font-medium transition-all duration-300',
                    activeTab === 'habits'
                      ? 'bg-red-600/10 text-red-400 border border-transparent border-l-2 border-l-red-500'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent border-l-2 border-l-transparent'
                  )}
                >
                  <Repeat className="h-5 w-5" />
                  Habits
                </button>
                <button
                  onClick={() => handleNavigate('weeklyReview')}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-3 min-h-[44px] rounded-lg text-sm font-medium transition-all duration-300',
                    activeTab === 'weeklyReview'
                      ? 'bg-red-600/10 text-red-400 border border-transparent border-l-2 border-l-red-500'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent border-l-2 border-l-transparent'
                  )}
                >
                  <CalendarCheck className="h-5 w-5" />
                  Weekly Review
                </button>
              </div>
            </div>
          </nav>

          {/* Footer with Settings & Lock — generous touch targets */}
          <div className="px-3 py-4 border-t border-neutral-800 shrink-0 space-y-1 animate-slow-fade-in-stagger">
            <button
              onClick={handleOpenSettings}
              className="flex items-center gap-3 w-full px-3 py-3 min-h-[44px] rounded-lg text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all duration-300 border border-transparent border-l-2 border-l-transparent"
            >
              <Settings className="h-5 w-5" />
              Settings
            </button>
            <button
              onClick={handleLock}
              className="flex items-center gap-3 w-full px-3 py-3 min-h-[44px] rounded-lg text-sm font-medium text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-all duration-300 border border-transparent border-l-2 border-l-transparent"
            >
              <LogOut className="h-5 w-5" />
              Lock
            </button>
            <div className="px-3 pt-2">
              <p className="text-xs text-neutral-600">{osName} — Life OS</p>
              <p className="text-xs text-neutral-700 mt-0.5">Aligned &bull; Disciplined &bull; Joyful</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile Bottom Navigation — refined & minimal: thinner bar, more
          spacing, subtle active indicator. Reduced visual weight so the
          slide-out drawer (hamburger) feels like the primary navigation. */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/85 dark:bg-neutral-950/85 backdrop-blur-xl border-t border-border/60 safe-area-pb">
        <div className="flex items-center justify-around px-3 h-14">
          {mobileNavItems.map((item) => (
            <motion.button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              whileTap={{ scale: 0.92 }}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-4 py-1.5 rounded-lg transition-colors duration-300 tap-feedback relative',
                activeTab === item.id
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-neutral-400 dark:text-neutral-600'
              )}
            >
              {item.icon}
              <span className={cn(
                'text-[10px] font-medium tracking-wide transition-opacity duration-300',
                activeTab === item.id ? 'opacity-100' : 'opacity-70'
              )}>{item.label}</span>
              {activeTab === item.id && (
                <motion.div
                  layoutId="mobile-nav-indicator"
                  className="absolute -top-px left-1/2 -translate-x-1/2 h-[2px] w-6 rounded-full bg-red-600/80"
                  transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                />
              )}
            </motion.button>
          ))}
        </div>
      </nav>
    </>
  )
}
