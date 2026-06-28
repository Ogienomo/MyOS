'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Plus, Heart, Wallet, BookOpen, MessageCircle, Search, X } from 'lucide-react'

const actions = [
  { icon: Heart, label: 'Log Mood', tab: 'moodLog' },
  { icon: Wallet, label: 'Add Finance', tab: 'finances' },
  { icon: BookOpen, label: 'Journal', tab: 'journal' },
  { icon: MessageCircle, label: 'AI Coach', tab: 'chat' },
  { icon: Search, label: 'Search', action: 'search' },
]

export function QuickActions() {
  const [open, setOpen] = useState(false)
  const { setActiveTab } = useAppStore()

  const handleAction = (action: typeof actions[0]) => {
    if (action.action === 'search') {
      document.dispatchEvent(new CustomEvent('open-search'))
    } else if (action.tab) {
      setActiveTab(action.tab as any)
    }
    setOpen(false)
  }

  return (
    <div className="fixed bottom-24 right-4 z-40 md:hidden">
      {open && (
        <div className="absolute bottom-14 right-0 space-y-2 animate-in slide-in-from-bottom-2 duration-200">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => handleAction(action)}
              className="flex items-center gap-3 bg-white dark:bg-neutral-800 shadow-lg rounded-full pl-4 pr-3 py-2 border border-neutral-100 dark:border-neutral-700 hover:border-red-200 dark:hover:border-red-800 transition-colors"
            >
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200 whitespace-nowrap">{action.label}</span>
              <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                <action.icon className="h-4 w-4 text-red-600" />
              </div>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          open ? 'bg-neutral-700 rotate-45' : 'bg-red-600'
        }`}
      >
        {open ? (
          <X className="h-5 w-5 text-white" />
        ) : (
          <Plus className="h-5 w-5 text-white" />
        )}
      </button>
    </div>
  )
}
