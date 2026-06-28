'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAppStore, TabId } from '@/lib/store'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command'
import {
  BookOpen,
  Brain,
  Target,
  Wallet,
  MessageCircle,
  AlertTriangle,
  Search,
  Loader2,
} from 'lucide-react'

interface SearchResult {
  id: string
  type: string
  [key: string]: unknown
}

interface SearchResults {
  journal: SearchResult[]
  memories: SearchResult[]
  goals: SearchResult[]
  finances: SearchResult[]
  chat: SearchResult[]
  alerts: SearchResult[]
}

interface CategoryConfig {
  key: keyof SearchResults
  label: string
  icon: React.ReactNode
  tab: TabId
}

const CATEGORIES: CategoryConfig[] = [
  { key: 'journal', label: 'Journal', icon: <BookOpen className="h-4 w-4 text-rose-600" />, tab: 'journal' },
  { key: 'memories', label: 'Memories', icon: <Brain className="h-4 w-4 text-red-700" />, tab: 'insights' },
  { key: 'goals', label: 'Goals', icon: <Target className="h-4 w-4 text-red-600" />, tab: 'goals' },
  { key: 'finances', label: 'Finances', icon: <Wallet className="h-4 w-4 text-red-600" />, tab: 'finances' },
  { key: 'chat', label: 'Chat', icon: <MessageCircle className="h-4 w-4 text-red-500" />, tab: 'chat' },
  { key: 'alerts', label: 'Alerts', icon: <AlertTriangle className="h-4 w-4 text-red-500" />, tab: 'insights' },
]

function getJournalSubtitle(item: SearchResult): string {
  const parts: string[] = []
  if (item.area) parts.push(capitalize(item.area as string))
  if (item.mood) parts.push(capitalize(item.mood as string))
  if (item.date) parts.push(formatDate(item.date as string))
  return parts.join(' · ')
}

function getMemorySubtitle(item: SearchResult): string {
  const parts: string[] = []
  if (item.area) parts.push(capitalize(item.area as string))
  if (item.type) parts.push(capitalize(item.type as string))
  if (item.date) parts.push(formatDate(item.date as string))
  return parts.join(' · ')
}

function getGoalSubtitle(item: SearchResult): string {
  const parts: string[] = []
  if (item.area) parts.push(capitalize(item.area as string))
  if (item.status) parts.push(capitalize(item.status as string))
  return parts.join(' · ')
}

function getFinanceSubtitle(item: SearchResult): string {
  const parts: string[] = []
  if (item.financeType) parts.push(item.financeType === 'received' ? 'Income' : 'Expense')
  if (item.amount != null) parts.push(`₦${Number(item.amount).toLocaleString()}`)
  if (item.date) parts.push(formatDate(item.date as string))
  return parts.join(' · ')
}

function getChatSubtitle(item: SearchResult): string {
  const parts: string[] = []
  if (item.role) parts.push(item.role === 'user' ? 'You' : 'AI')
  if (item.checkInType) parts.push(capitalize(item.checkInType as string))
  return parts.join(' · ')
}

function getAlertSubtitle(item: SearchResult): string {
  const parts: string[] = []
  if (item.area) parts.push(capitalize(item.area as string))
  if (item.severity) parts.push(capitalize(item.severity as string))
  if (item.date) parts.push(formatDate(item.date as string))
  return parts.join(' · ')
}

function getItemSubtitle(categoryKey: keyof SearchResults, item: SearchResult): string {
  switch (categoryKey) {
    case 'journal': return getJournalSubtitle(item)
    case 'memories': return getMemorySubtitle(item)
    case 'goals': return getGoalSubtitle(item)
    case 'finances': return getFinanceSubtitle(item)
    case 'chat': return getChatSubtitle(item)
    case 'alerts': return getAlertSubtitle(item)
    default: return ''
  }
}

function getItemTitle(categoryKey: keyof SearchResults, item: SearchResult): string {
  switch (categoryKey) {
    case 'journal':
      return (item.title as string) || (item.content as string) || 'Untitled entry'
    case 'memories':
      return (item.content as string) || ''
    case 'goals':
      return (item.title as string) || 'Untitled goal'
    case 'finances':
      return (item.category as string) || ((item.purpose as string) || 'Transaction')
    case 'chat':
      return (item.content as string) || ''
    case 'alerts':
      return (item.message as string) || 'Alert'
    default:
      return ''
  }
}

function capitalize(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatDate(d: string): string {
  if (!d) return ''
  try {
    const date = new Date(d)
    if (isNaN(date.getTime())) return d
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return d
  }
}

const EMPTY_RESULTS: SearchResults = {
  journal: [],
  memories: [],
  goals: [],
  finances: [],
  chat: [],
  alerts: [],
}

export function SearchDialog() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { setActiveTab, setHighlightItem } = useAppStore()

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Listen for custom 'open-search' event from SearchTrigger
  useEffect(() => {
    const handleOpenSearch = () => setOpen(true)
    window.addEventListener('open-search', handleOpenSearch)
    return () => window.removeEventListener('open-search', handleOpenSearch)
  }, [])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults(EMPTY_RESULTS)
      setLoading(false)
    }
  }, [open])

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(EMPTY_RESULTS)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data)
      }
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults(EMPTY_RESULTS)
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(() => {
      doSearch(query)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open, doSearch])

  const handleSelect = (tab: TabId, itemId: string, itemType: string) => {
    setOpen(false)
    setHighlightItem(itemId, itemType)
    setActiveTab(tab)
  }

  const hasResults = Object.values(results).some((arr) => arr.length > 0)
  const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search MyOS"
      description="Search across all your data"
      shouldFilter={false}
    >
      <CommandInput
        placeholder="Search journals, goals, finances, memories..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[70vh]">
        {loading && (
          <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching...
          </div>
        )}
        {!loading && query.trim() && !hasResults && (
          <CommandEmpty>No results found for &quot;{query}&quot;</CommandEmpty>
        )}
        {!loading && query.trim() && hasResults && (
          <div className="px-3 py-2 text-xs text-muted-foreground border-b">
            {totalResults} result{totalResults !== 1 ? 's' : ''} found
          </div>
        )}
        {!loading &&
          CATEGORIES.map((cat) => {
            const items = results[cat.key]
            if (!items || items.length === 0) return null
            return (
              <CommandGroup key={cat.key} heading={cat.label}>
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${cat.key}-${item.id}-${getItemTitle(cat.key, item)}`}
                    onSelect={() => handleSelect(cat.tab, item.id, cat.key)}
                    className="flex items-start gap-3 py-2.5 px-3 cursor-pointer select-text"
                  >
                    <span className="mt-0.5 shrink-0">{cat.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium break-words line-clamp-2">
                        {getItemTitle(cat.key, item)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 break-words">
                        {getItemSubtitle(cat.key, item)}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )
          })}
        {!query.trim() && !loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
            <Search className="h-8 w-8 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Start typing to search
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Search across journals, memories, goals, finances, and more
              </p>
            </div>
          </div>
        )}
      </CommandList>
    </CommandDialog>
  )
}

export function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 h-9 px-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-neutral-300 transition-colors text-sm text-neutral-500 shadow-sm w-full max-w-xs"
      aria-label="Search (⌘K)"
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="truncate flex-1 text-left">Search...</span>
      <kbd className="hidden sm:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border border-neutral-200 bg-neutral-100 px-1.5 font-mono text-[10px] font-medium text-neutral-500">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  )
}
