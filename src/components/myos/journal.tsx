'use client'

import { useState, useEffect, useCallback } from 'react'
import { JournalSkeleton } from './loading-skeleton'
import { useAppStore, JournalEntry } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import {
  BookOpen,
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { VoiceNoteButton } from './use-voice-note'
import { AREA_CONFIG, AREA_KEYS } from '@/lib/area-config'

// ─── Constants ──────────────────────────────────────────────────────────────

const AREA_COLORS: Record<string, string> = Object.fromEntries(
  AREA_KEYS.map(key => [key, AREA_CONFIG[key].color])
)
AREA_COLORS['general'] = 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'

const AREA_LABELS: Record<string, string> = Object.fromEntries(
  AREA_KEYS.map(key => [key, AREA_CONFIG[key].label])
)
AREA_LABELS['general'] = 'General'

const MOOD_EMOJI: Record<string, { emoji: string; label: string; score: number }> = {
  great: { emoji: '', label: 'Great', score: 10 },
  good: { emoji: '', label: 'Good', score: 8 },
  okay: { emoji: '', label: 'Okay', score: 6 },
  low: { emoji: '', label: 'Low', score: 4 },
  struggling: { emoji: '', label: 'Struggling', score: 2 },
}

// Subtle colored dot for mood — mirrors the getScoreDotClass pattern in mood-log.tsx
function getMoodDotClass(score: number): string {
  if (score <= 3) return 'bg-red-800'
  if (score <= 6) return 'bg-red-500'
  return 'bg-red-400'
}

type DateRange = 'thisWeek' | 'thisMonth' | 'last3Months' | 'allTime'

function getDateLabel(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function getDateRangeFilter(range: DateRange): { from?: string; to?: string } {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  switch (range) {
    case 'thisWeek': {
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      return { from: startOfWeek.toISOString().split('T')[0], to: today }
    }
    case 'thisMonth': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0]
      return { from: startOfMonth, to: today }
    }
    case 'last3Months': {
      const threeMonthsAgo = new Date(now)
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
      return { from: threeMonthsAgo.toISOString().split('T')[0], to: today }
    }
    case 'allTime':
    default:
      return {}
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

interface FormData {
  area: string
  title: string
  content: string
  mood: string
  tags: string
  date: string
}

const emptyForm: FormData = {
  area: 'general',
  title: '',
  content: '',
  mood: '',
  tags: '',
  date: new Date().toISOString().split('T')[0],
}

export function Journal() {
  const { highlightItemId, highlightItemType, clearHighlightItem } = useAppStore()
  const { toast } = useToast()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)

  // ─── Highlight item from search navigation ─────────────────────────────
  useEffect(() => {
    if (!highlightItemId || highlightItemType !== 'journal') return

    let found = false
    let attempts = 0
    const maxAttempts = 10 // 10 * 200ms = 2 seconds max

    const tryScroll = () => {
      const el = document.getElementById(`item-${highlightItemId}`)
      if (el) {
        found = true
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(clearHighlightItem, 3000)
      } else if (attempts < maxAttempts) {
        attempts++
        setTimeout(tryScroll, 200)
      } else {
        // Gave up finding the element
        clearHighlightItem()
      }
    }

    tryScroll()
  }, [highlightItemId, highlightItemType, clearHighlightItem])

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [areaFilter, setAreaFilter] = useState('all')
  const [moodFilter, setMoodFilter] = useState('all')
  const [dateRange, setDateRange] = useState<DateRange>('allTime')

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Expanded entries
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // ─── Fetch entries ──────────────────────────────────────────────────────

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/journal')
      const data = await res.json()
      if (data.entries) {
        setEntries(data.entries)
      }
    } catch (err) {
      console.error('Failed to fetch journal entries:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  // ─── Filter entries (client-side) ───────────────────────────────────────

  const filteredEntries = entries.filter((entry) => {
    // Area filter
    if (areaFilter !== 'all' && entry.area !== areaFilter) return false

    // Mood filter
    if (moodFilter !== 'all' && entry.mood !== moodFilter) return false

    // Date range filter
    const rangeFilter = getDateRangeFilter(dateRange)
    if (rangeFilter.from && entry.date < rangeFilter.from) return false
    if (rangeFilter.to && entry.date > rangeFilter.to) return false

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchesTitle = entry.title?.toLowerCase().includes(q)
      const matchesContent = entry.content?.toLowerCase().includes(q)
      const matchesTags = entry.tags?.toLowerCase().includes(q)
      if (!matchesTitle && !matchesContent && !matchesTags) return false
    }

    return true
  })

  // ─── Group entries by date ──────────────────────────────────────────────

  const groupedEntries: { date: string; label: string; entries: JournalEntry[] }[] = []
  const groupMap = new Map<string, JournalEntry[]>()

  for (const entry of filteredEntries) {
    const dateKey = entry.date
    if (!groupMap.has(dateKey)) {
      groupMap.set(dateKey, [])
    }
    groupMap.get(dateKey)!.push(entry)
  }

  // Sort dates descending
  const sortedDates = [...groupMap.keys()].sort((a, b) => b.localeCompare(a))
  for (const dateKey of sortedDates) {
    groupedEntries.push({
      date: dateKey,
      label: getDateLabel(dateKey),
      entries: groupMap.get(dateKey)!,
    })
  }

  // ─── Form handlers ─────────────────────────────────────────────────────

  const handleNewEntry = () => {
    setEditingId(null)
    setFormData(emptyForm)
    setShowForm(true)
  }

  const handleEdit = (entry: JournalEntry) => {
    setEditingId(entry.id)
    setFormData({
      area: entry.area,
      title: entry.title || '',
      content: entry.content,
      mood: entry.mood || '',
      tags: entry.tags || '',
      date: entry.date,
    })
    setShowForm(true)
  }

  const handleCancelForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData(emptyForm)
  }

  const handleSave = async () => {
    if (!formData.content.trim() || !formData.area || !formData.date) return

    setSaving(true)
    try {
      if (editingId) {
        // PATCH update
        const res = await fetch('/api/journal', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingId,
            area: formData.area,
            title: formData.title || null,
            content: formData.content,
            mood: formData.mood || null,
            tags: formData.tags || null,
            date: formData.date,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          console.error('Failed to update entry:', data.error)
        }
      } else {
        // POST create
        const res = await fetch('/api/journal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            area: formData.area,
            title: formData.title || null,
            content: formData.content,
            mood: formData.mood || null,
            tags: formData.tags || null,
            date: formData.date,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          console.error('Failed to create entry:', data.error)
        }
      }

      await fetchEntries()
      setShowForm(false)
      setEditingId(null)
      setFormData(emptyForm)
      toast({ title: 'Journal saved', description: 'Your entry has been saved.' })
    } catch (err) {
      console.error('Save error:', err)
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return

    try {
      const res = await fetch(`/api/journal?id=${deleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        console.error('Failed to delete entry:', data.error)
      }
      await fetchEntries()
    } catch (err) {
      console.error('Delete error:', err)
    } finally {
      setDeleteId(null)
    }
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return <JournalSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Journal</h2>
          <p className="text-xs text-neutral-500">Your thoughts, reflections, and growth</p>
        </div>
        <Button
          onClick={handleNewEntry}
          className="bg-red-600 hover:bg-red-700 text-white shrink-0"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Entry
        </Button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="shadow-sm border-red-200 dark:border-red-900/30 bg-white dark:bg-neutral-900">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                {editingId ? 'Edit Entry' : 'New Journal Entry'}
              </h3>
              <button
                onClick={handleCancelForm}
                className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
              >
                <X className="h-4 w-4 text-neutral-400" />
              </button>
            </div>

            {/* Area Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Area *</Label>
              <Select
                value={formData.area}
                onValueChange={(val) => setFormData((f) => ({ ...f, area: val }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select area" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AREA_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Title (optional)</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                placeholder="Give this entry a title..."
                className="text-sm"
              />
            </div>

            {/* Content */}
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <Label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mt-1.5">Content *</Label>
                <VoiceNoteButton
                  value={formData.content}
                  onChange={(val) => setFormData((f) => ({ ...f, content: val }))}
                  label="journal content"
                />
              </div>
              {/* Prompt chips */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {[
                  "What am I most proud of today?",
                  "Where did I drift and why?",
                  "What's one thing I must not repeat tomorrow?",
                  "How did I serve others today?",
                  "What is God saying to me right now?",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setFormData((f) => ({
                      ...f,
                      content: f.content.trim() === ''
                        ? `**Prompt:** ${prompt}\n`
                        : `${f.content}\n**Prompt:** ${prompt}\n`,
                    }))}
                    className="shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData((f) => ({ ...f, content: e.target.value }))}
                placeholder="Write your thoughts..."
                className="text-sm min-h-[120px] resize-y"
                rows={5}
              />
            </div>

            {/* Mood Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Mood (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(MOOD_EMOJI).map(([key, { emoji, label, score }]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setFormData((f) => ({ ...f, mood: f.mood === key ? '' : key }))
                    }
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                      formData.mood === key
                        ? 'bg-red-50 border-red-300 text-red-700 shadow-sm'
                        : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                    }`}
                  >
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${getMoodDotClass(score)}`}
                      aria-hidden="true"
                    />
                    <span className="font-mono tabular-nums text-neutral-500 dark:text-neutral-400">{score}</span>
                    <span className="text-neutral-300 dark:text-neutral-600">—</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Tags (comma-separated)</Label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData((f) => ({ ...f, tags: e.target.value }))}
                placeholder="e.g. gratitude, reflection, prayer"
                className="text-sm"
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((f) => ({ ...f, date: e.target.value }))}
                className="text-sm"
              />
            </div>

            {/* Save / Cancel */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={saving || !formData.content.trim() || !formData.area || !formData.date}
                className="bg-red-600 hover:bg-red-700 text-white"
                size="sm"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : editingId ? (
                  'Update Entry'
                ) : (
                  'Save Entry'
                )}
              </Button>
              <Button onClick={handleCancelForm} variant="outline" size="sm">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter / Search Bar */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, content, or tags..."
            className="pl-9 text-sm"
          />
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap gap-2">
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-[140px] text-xs">
              <SelectValue placeholder="Area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Areas</SelectItem>
              {Object.entries(AREA_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={moodFilter} onValueChange={setMoodFilter}>
            <SelectTrigger className="w-[160px] text-xs">
              <SelectValue placeholder="Mood" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Moods</SelectItem>
              {Object.entries(MOOD_EMOJI).map(([key, { label, score }]) => (
                <SelectItem key={key} value={key}>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${getMoodDotClass(score)}`}
                      aria-hidden="true"
                    />
                    <span className="font-mono tabular-nums">{score}</span>
                    <span className="text-neutral-400">—</span>
                    <span>{label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={(val) => setDateRange(val as DateRange)}>
            <SelectTrigger className="w-[150px] text-xs">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="thisWeek">This Week</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="last3Months">Last 3 Months</SelectItem>
              <SelectItem value="allTime">All Time</SelectItem>
            </SelectContent>
          </Select>

          {(searchQuery || areaFilter !== 'all' || moodFilter !== 'all' || dateRange !== 'allTime') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setAreaFilter('all')
                setMoodFilter('all')
                setDateRange('allTime')
              }}
              className="text-xs text-neutral-500 hover:text-red-600"
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Journal Entries Timeline */}
      {filteredEntries.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 mb-4">
            <BookOpen className="h-8 w-8 text-neutral-400" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Your journal is empty</h3>
          <p className="text-xs text-neutral-400 mb-4">Start writing your first entry</p>
          <Button
            onClick={handleNewEntry}
            className="bg-red-600 hover:bg-red-700 text-white"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Write First Entry
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedEntries.map((group) => (
            <div key={group.date}>
              {/* Date Header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-neutral-200" />
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider whitespace-nowrap">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-neutral-200" />
              </div>

              {/* Entries */}
              <div className="space-y-3">
                {group.entries.map((entry) => {
                  const isExpanded = expandedIds.has(entry.id)
                  const areaColor = AREA_COLORS[entry.area] || AREA_COLORS.general
                  const areaLabel = AREA_LABELS[entry.area] || entry.area
                  const moodData = entry.mood ? MOOD_EMOJI[entry.mood] : null
                  const tags = entry.tags
                    ? entry.tags
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean)
                    : []

                  return (
                    <Card
                      key={entry.id}
                      id={`item-${entry.id}`}
                      className={`shadow-sm border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors ${highlightItemId === entry.id && highlightItemType === 'journal' ? 'ring-2 ring-rose-400 bg-rose-50 dark:bg-rose-950/30 animate-pulse' : ''}`}
                    >
                      <CardContent className="p-4">
                        {/* Top row: area badge + actions */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="secondary"
                              className={`text-[10px] font-semibold px-2 py-0.5 ${areaColor}`}
                            >
                              {areaLabel}
                            </Badge>
                            {moodData && (
                              <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                                <span
                                  className={`inline-block w-1.5 h-1.5 rounded-full ${getMoodDotClass(moodData.score)}`}
                                  aria-hidden="true"
                                />
                                <span className="font-mono tabular-nums">{moodData.score}</span>
                                <span className="text-neutral-300 dark:text-neutral-600">—</span>
                                <span>{moodData.label}</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleEdit(entry)}
                              className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5 text-neutral-400" />
                            </button>
                            <button
                              onClick={() => setDeleteId(entry.id)}
                              className="p-1.5 rounded-md hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-neutral-400 hover:text-red-500" />
                            </button>
                          </div>
                        </div>

                        {/* Title */}
                        {(entry.title || entry.content) && (
                          <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-1.5">
                            {entry.title || entry.content.split('\n')[0].slice(0, 80)}
                          </h4>
                        )}

                        {/* Content */}
                        {entry.content && (
                          <div className="relative">
                            <p
                              className={`text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed whitespace-pre-wrap ${
                                !isExpanded ? 'line-clamp-3' : ''
                              }`}
                            >
                              {entry.title
                                ? entry.content
                                : entry.content.split('\n').slice(1).join('\n') || entry.content}
                            </p>
                            {entry.content.length > 150 && (
                              <button
                                onClick={() => toggleExpanded(entry.id)}
                                className="inline-flex items-center gap-0.5 text-[10px] text-red-600 hover:text-red-700 mt-2 font-medium"
                              >
                                {isExpanded ? (
                                  <>
                                    Show less <ChevronUp className="h-3 w-3" />
                                  </>
                                ) : (
                                  <>
                                    Read more <ChevronDown className="h-3 w-3" />
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Tags */}
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {tags.map((tag, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 px-1.5 py-0.5 font-normal"
                              >
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation AlertDialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Journal Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this journal entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
