'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAppStore, QuickLogData } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Heart, Zap, Brain, Loader2, TrendingUp, ChevronDown, ChevronUp,
  Activity, Sparkles, CalendarDays, BarChart3, Lightbulb,
  Plus, X, Pin,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { motion } from 'framer-motion'

function getMoodLabel(value: number): string {
  if (value <= 3) return 'Struggling'
  if (value <= 5) return 'Low'
  if (value === 6) return 'Okay'
  if (value <= 8) return 'Good'
  return 'Great'
}

function getEnergyLabel(value: number): string {
  if (value <= 3) return 'Drained'
  if (value <= 5) return 'Moderate'
  if (value <= 7) return 'Energized'
  return 'Supercharged'
}

function getFocusLabel(value: number): string {
  if (value <= 3) return 'Foggy'
  if (value <= 5) return 'On track'
  if (value <= 7) return 'Focused'
  return 'Locked in'
}

// Colored dot class for a 1-10 score (kept subtle — no emoji)
function getScoreDotClass(value: number): string {
  if (value <= 3) return 'bg-red-800'
  if (value <= 6) return 'bg-red-500'
  return 'bg-red-400'
}

interface TrendData {
  date: string
  mood: number
  energy: number
  focus: number
}

const DEFAULT_MOOD_TAGS = [
  'Work stress', 'Good sleep', 'Exercise', 'Social time',
  'Productive day', 'Lazy day', 'Anxious', 'Grateful',
  'Headache', 'Creative flow', 'Family time', 'Late night',
]

const PRESET_COLORS = [
  '#ef4444', '#dc2626', '#f43f5e', '#b91c1c',
  '#e11d48', '#fda4af',
]

interface CustomMoodTag {
  id: string
  name: string
  emoji: string | null
  color: string | null
  pinned: boolean
}

interface HeatmapDay {
  date: string
  avgMood: number | null
  count: number
  dayLabel: string
}

export function MoodLog() {
  const { moodLogs, setMoodLogs, moodLogsLoading, setMoodLogsLoading, setTodayQuickLog } = useAppStore()
  const { toast } = useToast()
  const [mood, setMood] = useState(5)
  const [energy, setEnergy] = useState(5)
  const [focus, setFocus] = useState(5)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [showRecent, setShowRecent] = useState(true)
  const [showInsights, setShowInsights] = useState(true)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [trendData, setTrendData] = useState<TrendData[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [customTags, setCustomTags] = useState<CustomMoodTag[]>([])
  const [showCreateTag, setShowCreateTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagEmoji, setNewTagEmoji] = useState('')
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0])
  const [newTagPinned, setNewTagPinned] = useState(false)
  const [creatingTag, setCreatingTag] = useState(false)

  const fetchLogs = useCallback(async () => {
    setMoodLogsLoading(true)
    try {
      const [recentRes, weekRes] = await Promise.all([
        fetch('/api/quicklog?range=recent&limit=20'),
        fetch('/api/quicklog?range=week'),
      ])
      if (recentRes.ok) {
        const data = await recentRes.json()
        setMoodLogs(data.logs || [])
      }
      if (weekRes.ok) {
        const data = await weekRes.json()
        const logs = data.logs || []
        // Aggregate by date for trend chart
        const byDate: Record<string, { mood: number[]; energy: number[]; focus: number[] }> = {}
        for (const log of logs) {
          if (!byDate[log.date]) {
            byDate[log.date] = { mood: [], energy: [], focus: [] }
          }
          byDate[log.date].mood.push(log.mood)
          byDate[log.date].energy.push(log.energy)
          byDate[log.date].focus.push(log.focus)
        }
        const trend: TrendData[] = Object.entries(byDate).map(([date, vals]) => ({
          date: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          mood: Math.round(vals.mood.reduce((a, b) => a + b, 0) / vals.mood.length * 10) / 10,
          energy: Math.round(vals.energy.reduce((a, b) => a + b, 0) / vals.energy.length * 10) / 10,
          focus: Math.round(vals.focus.reduce((a, b) => a + b, 0) / vals.focus.length * 10) / 10,
        }))
        setTrendData(trend)
      }
    } catch (err) {
      console.error('Failed to fetch mood logs:', err)
    } finally {
      setMoodLogsLoading(false)
    }
  }, [setMoodLogs, setMoodLogsLoading])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const fetchCustomTags = useCallback(async () => {
    try {
      const res = await fetch('/api/mood-tags')
      if (res.ok) {
        const data = await res.json()
        setCustomTags(data.tags || [])
      }
    } catch (err) {
      console.error('Failed to fetch custom mood tags:', err)
    }
  }, [])

  useEffect(() => {
    fetchCustomTags()
  }, [fetchCustomTags])

  // Merge default + custom tags (pinned custom tags first, then default, then unpinned custom)
  const allTags = useMemo(() => {
    const pinnedCustom = customTags.filter(t => t.pinned).map(t => ({ key: `custom-${t.id}`, label: t.emoji ? `${t.emoji} ${t.name}` : t.name, customId: t.id, color: t.color }))
    const defaultTags = DEFAULT_MOOD_TAGS.map(t => ({ key: `default-${t}`, label: t, customId: null, color: null }))
    const unpinnedCustom = customTags.filter(t => !t.pinned).map(t => ({ key: `custom-${t.id}`, label: t.emoji ? `${t.emoji} ${t.name}` : t.name, customId: t.id, color: t.color }))
    return [...pinnedCustom, ...defaultTags, ...unpinnedCustom]
  }, [customTags])

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    setCreatingTag(true)
    try {
      const res = await fetch('/api/mood-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim(), emoji: newTagEmoji || null, color: newTagColor, pinned: newTagPinned }),
      })
      if (res.ok) {
        setNewTagName('')
        setNewTagEmoji('')
        setNewTagColor(PRESET_COLORS[0])
        setNewTagPinned(false)
        setShowCreateTag(false)
        await fetchCustomTags()
      }
    } catch (err) {
      console.error('Failed to create mood tag:', err)
    } finally {
      setCreatingTag(false)
    }
  }

  const handleDeleteTag = async (tagId: string) => {
    try {
      const res = await fetch(`/api/mood-tags?id=${tagId}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchCustomTags()
      }
    } catch (err) {
      console.error('Failed to delete mood tag:', err)
    }
  }

  const handleTogglePin = async (tagId: string, currentPinned: boolean) => {
    try {
      await fetch('/api/mood-tags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tagId, pinned: !currentPinned }),
      })
      await fetchCustomTags()
    } catch (err) {
      console.error('Failed to toggle pin:', err)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Append tags to note if any selected (use label for readability)
      const tagLabels = selectedTags.map(key => {
        const found = allTags.find(t => t.key === key)
        return found ? found.label : key
      })
      const tagSuffix = tagLabels.length > 0 ? `\n[${tagLabels.join(', ')}]` : ''
      const fullNote = (note.trim() + tagSuffix).trim() || null

      const res = await fetch('/api/quicklog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood, energy, focus, note: fullNote }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.log) {
          setTodayQuickLog(data.log)
        }
        setNote('')
        setSelectedTags([])
        await fetchLogs()
        // Trigger dashboard refresh so streaks update immediately
        window.dispatchEvent(new CustomEvent('myos-refresh-dashboard'))
        toast({ title: 'Mood logged', description: 'Your check-in has been saved.' })
      }
    } catch (err) {
      console.error('Failed to save mood log:', err)
      toast({ title: 'Failed to log mood', description: 'Please try again.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const toggleTag = (tagKey: string) => {
    setSelectedTags(prev =>
      prev.includes(tagKey) ? prev.filter(t => t !== tagKey) : [...prev, tagKey]
    )
  }

  const handleQuickMood = (quickMood: number, quickEnergy: number, quickFocus: number) => {
    setMood(quickMood)
    setEnergy(quickEnergy)
    setFocus(quickFocus)
  }

  // Compute averages
  const todayLogs = moodLogs.filter(l => l.date === new Date().toISOString().split('T')[0])
  const todayMoodAvg = todayLogs.length > 0 ? Math.round(todayLogs.reduce((s, l) => s + l.mood, 0) / todayLogs.length * 10) / 10 : null
  const todayEnergyAvg = todayLogs.length > 0 ? Math.round(todayLogs.reduce((s, l) => s + l.energy, 0) / todayLogs.length * 10) / 10 : null
  const todayFocusAvg = todayLogs.length > 0 ? Math.round(todayLogs.reduce((s, l) => s + l.focus, 0) / todayLogs.length * 10) / 10 : null

  // Weekly summary computation
  const weeklySummary = useMemo(() => {
    if (trendData.length === 0) return null
    const avgMood = Math.round(trendData.reduce((s, d) => s + d.mood, 0) / trendData.length * 10) / 10
    const avgEnergy = Math.round(trendData.reduce((s, d) => s + d.energy, 0) / trendData.length * 10) / 10
    const avgFocus = Math.round(trendData.reduce((s, d) => s + d.focus, 0) / trendData.length * 10) / 10
    const bestDay = trendData.reduce((best, d) => d.mood > best.mood ? d : best, trendData[0])
    const worstDay = trendData.reduce((worst, d) => d.mood < worst.mood ? d : worst, trendData[0])
    return { avgMood, avgEnergy, avgFocus, bestDay: bestDay.date, worstDay: worstDay.date, daysTracked: trendData.length }
  }, [trendData])

  // Compute insights
  const insights = useMemo(() => {
    const result: string[] = []
    if (trendData.length < 2) return result

    // Trend direction
    const latest = trendData[trendData.length - 1]
    const prev = trendData[trendData.length - 2]
    if (latest.mood > prev.mood) result.push('Your mood is trending up compared to yesterday')
    else if (latest.mood < prev.mood) result.push('Your mood dipped compared to yesterday')
    else result.push('Your mood is stable compared to yesterday')

    if (latest.energy > prev.energy) result.push('Energy levels are rising')
    else if (latest.energy < prev.energy) result.push('Energy levels have dipped')

    if (latest.focus > prev.focus) result.push('Focus is improving')
    else if (latest.focus < prev.focus) result.push('Focus has decreased')

    // Week-level trends (need at least 3 days)
    if (trendData.length >= 3) {
      const firstHalf = trendData.slice(0, Math.floor(trendData.length / 2))
      const secondHalf = trendData.slice(Math.floor(trendData.length / 2))
      const firstMoodAvg = firstHalf.reduce((s, d) => s + d.mood, 0) / firstHalf.length
      const secondMoodAvg = secondHalf.reduce((s, d) => s + d.mood, 0) / secondHalf.length
      const moodDiff = Math.round((secondMoodAvg - firstMoodAvg) / firstMoodAvg * 100)
      if (moodDiff > 10) result.push(`Your mood is ${moodDiff}% higher in recent days vs. earlier this week`)
      else if (moodDiff < -10) result.push(`Your mood is ${Math.abs(moodDiff)}% lower in recent days vs. earlier this week`)

      // Energy-focus correlation
      const avgEnergyAll = trendData.reduce((s, d) => s + d.energy, 0) / trendData.length
      const avgFocusAll = trendData.reduce((s, d) => s + d.focus, 0) / trendData.length
      if (avgEnergyAll > avgFocusAll + 1) result.push('Your energy tends to outpace your focus — try channeling energy into directed tasks')
      else if (avgFocusAll > avgEnergyAll + 1) result.push('Your focus often exceeds your energy — watch for burnout and rest when needed')

      // Mood vs Energy alignment
      const moodEnergyDiff = Math.abs(trendData.reduce((s, d) => s + (d.mood - d.energy), 0) / trendData.length)
      if (moodEnergyDiff < 1) result.push('Your mood and energy are closely aligned — they move together')
      else if (moodEnergyDiff > 2) result.push('Your mood and energy often diverge — your mood may be influenced by non-physical factors')

      // Consistency score
      const moodVariance = trendData.reduce((s, d) => s + Math.pow(d.mood - (trendData.reduce((ss, dd) => ss + dd.mood, 0) / trendData.length), 2), 0) / trendData.length
      if (moodVariance < 1) result.push('Your mood has been very consistent this week')
      else if (moodVariance > 4) result.push('Your mood has been quite variable — consider what external factors might be driving swings')
    }

    // Best/worst day insights
    if (trendData.length >= 3) {
      const bestDay = trendData.reduce((best, d) => d.mood > best.mood ? d : best, trendData[0])
      const worstDay = trendData.reduce((worst, d) => d.mood < worst.mood ? d : worst, trendData[0])
      if (bestDay.date !== worstDay.date) {
        result.push(`Best day: ${bestDay.date} (mood ${bestDay.mood})`)
        result.push(`Toughest day: ${worstDay.date} (mood ${worstDay.mood})`)
      }
    }

    return result
  }, [trendData])

  // Heatmap data for past 30 days
  const heatmapData = useMemo((): HeatmapDay[] => {
    const days: HeatmapDay[] = []
    const today = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const dayLogs = moodLogs.filter(l => l.date === dateStr)
      days.push({
        date: dateStr,
        avgMood: dayLogs.length > 0 ? Math.round(dayLogs.reduce((s, l) => s + l.mood, 0) / dayLogs.length * 10) / 10 : null,
        count: dayLogs.length,
        dayLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      })
    }
    return days
  }, [moodLogs])

  function getMoodColor(value: number | null): string {
    if (value === null) return 'bg-neutral-100 dark:bg-neutral-800'
    if (value <= 2) return 'bg-red-800 dark:bg-red-700'
    if (value <= 4) return 'bg-red-600 dark:bg-red-500'
    if (value <= 6) return 'bg-rose-500 dark:bg-rose-400'
    if (value <= 8) return 'bg-red-500 dark:bg-red-400'
    return 'bg-red-400 dark:bg-red-300'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-500 animate-slow-pulse" />
          Mood Log
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Track how you feel, your energy, and your focus</p>
      </motion.div>

      {/* Today's Summary */}
      {todayLogs.length > 0 && (
        <div className="grid grid-cols-3 gap-3 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="h-full"
          >
          <Card className="h-full shadow-sm border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20 border-red-200 dark:border-red-900">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className={`inline-block w-2 h-2 rounded-full ${getScoreDotClass(todayMoodAvg || 5)}`} aria-hidden="true" />
                <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">Mood</span>
              </div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{todayMoodAvg}<span className="text-sm font-normal text-neutral-400">/10</span></p>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1">{getMoodLabel(todayMoodAvg || 5)}</p>
            </CardContent>
          </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: 'easeOut' }}
            className="h-full"
          >
          <Card className="h-full shadow-sm border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/20 border-rose-200 dark:border-rose-900">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className={`inline-block w-2 h-2 rounded-full ${getScoreDotClass(todayEnergyAvg || 5)}`} aria-hidden="true" />
                <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">Energy</span>
              </div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{todayEnergyAvg}<span className="text-sm font-normal text-neutral-400">/10</span></p>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1">{getEnergyLabel(todayEnergyAvg || 5)}</p>
            </CardContent>
          </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16, ease: 'easeOut' }}
            className="h-full"
          >
          <Card className="h-full shadow-sm border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20 border-red-200 dark:border-red-900">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className={`inline-block w-2 h-2 rounded-full ${getScoreDotClass(todayFocusAvg || 5)}`} aria-hidden="true" />
                <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">Focus</span>
              </div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{todayFocusAvg}<span className="text-sm font-normal text-neutral-400">/10</span></p>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1">{getFocusLabel(todayFocusAvg || 5)}</p>
            </CardContent>
          </Card>
          </motion.div>
        </div>
      )}

      {/* Log Entry Form */}
      <Card className="shadow-sm border-neutral-200 dark:border-neutral-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-neutral-900 dark:text-white">How are you right now?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Quick Actions */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Quick log</label>
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleQuickMood(9, 9, 8)}
                className="flex-1 py-2.5 px-3 rounded-lg border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all text-xs font-semibold text-rose-800 dark:text-rose-300 shadow-sm"
              >
                Great day
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleQuickMood(5, 5, 5)}
                className="flex-1 py-2.5 px-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-all text-xs font-medium text-neutral-700 dark:text-neutral-300 shadow-sm"
              >
                Okay
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleQuickMood(2, 3, 2)}
                className="flex-1 py-2.5 px-3 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all text-xs font-medium text-red-700 dark:text-red-400 shadow-sm"
              >
                Rough day
              </motion.button>
            </div>
          </div>

          {/* Mood Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-red-500" /> Mood
              </label>
              <span className={`text-sm font-semibold flex items-center gap-1.5 ${mood <= 3 ? 'text-red-800' : mood <= 5 ? 'text-red-600' : mood <= 7 ? 'text-red-500' : 'text-red-400'}`}>
                {mood}/10 <span className="text-xs font-normal text-neutral-500">({getMoodLabel(mood)})</span>
              </span>
            </div>
            <div className="px-1">
              <Slider
                value={[mood]}
                min={1}
                max={10}
                step={1}
                onValueChange={(v) => setMood(v[0])}
                className="w-full"
              />
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-red-800">Struggling</span>
              <span className="text-rose-500">Okay</span>
              <span className="text-red-400">Great</span>
            </div>
          </div>

          {/* Energy Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-rose-500" /> Energy
              </label>
              <span className={`text-sm font-semibold flex items-center gap-1.5 ${energy <= 3 ? 'text-red-800' : energy <= 5 ? 'text-red-600' : energy <= 7 ? 'text-red-500' : 'text-red-400'}`}>
                {energy}/10
              </span>
            </div>
            <div className="px-1">
              <Slider
                value={[energy]}
                min={1}
                max={10}
                step={1}
                onValueChange={(v) => setEnergy(v[0])}
                className="w-full"
              />
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-red-800">Drained</span>
              <span className="text-rose-500">Moderate</span>
              <span className="text-red-400">Supercharged</span>
            </div>
          </div>

          {/* Focus Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-red-600" /> Focus
              </label>
              <span className={`text-sm font-semibold flex items-center gap-1.5 ${focus <= 3 ? 'text-red-800' : focus <= 5 ? 'text-red-600' : focus <= 7 ? 'text-red-500' : 'text-red-400'}`}>
                {focus}/10
              </span>
            </div>
            <div className="px-1">
              <Slider
                value={[focus]}
                min={1}
                max={10}
                step={1}
                onValueChange={(v) => setFocus(v[0])}
                className="w-full"
              />
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-red-800">Foggy</span>
              <span className="text-rose-500">On track</span>
              <span className="text-red-400">Locked in</span>
            </div>
          </div>

          {/* Mood Tags/Triggers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">What's influencing your mood?</label>
              <button
                onClick={() => setShowCreateTag(!showCreateTag)}
                className="text-[10px] text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium flex items-center gap-0.5"
              >
                <Plus className="h-3 w-3" /> Create Tag
              </button>
            </div>

            {/* Create Tag Inline Form */}
            {showCreateTag && (
              <div className="p-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTagEmoji}
                    onChange={(e) => setNewTagEmoji(e.target.value)}
                    placeholder="Emoji"
                    className="w-14 text-center text-sm px-2 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 dark:text-white"
                    maxLength={2}
                  />
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Tag name"
                    className="flex-1 text-sm px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 dark:text-white"
                    maxLength={30}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-neutral-500">Color:</span>
                  <div className="flex gap-1.5">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setNewTagColor(c)}
                        className={`w-5 h-5 rounded-full border-2 transition-transform ${newTagColor === c ? 'border-neutral-900 dark:border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[10px] text-neutral-600 dark:text-neutral-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTagPinned}
                      onChange={(e) => setNewTagPinned(e.target.checked)}
                      className="rounded border-neutral-300"
                    />
                    <Pin className="h-3 w-3" /> Pin to top
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCreateTag(false)}
                      className="text-[10px] px-2.5 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-700"
                    >Cancel</button>
                    <button
                      onClick={handleCreateTag}
                      disabled={creatingTag || !newTagName.trim()}
                      className="text-[10px] px-3 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creatingTag ? '...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tags List */}
            <div className="flex flex-wrap gap-1.5">
              {allTags.map(tag => (
                <div key={tag.key} className="relative group">
                  <button
                    onClick={() => toggleTag(tag.key)}
                    className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                      selectedTags.includes(tag.key)
                        ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400'
                        : tag.color
                          ? 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600'
                          : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600'
                    }`}
                    style={tag.color && !selectedTags.includes(tag.key) ? { borderColor: tag.color, color: tag.color } : undefined}
                  >
                    {tag.label}
                  </button>
                  {tag.customId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteTag(tag.customId!) }}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 dark:hover:bg-red-800 hover:text-red-600 dark:hover:text-red-400"
                      title="Delete tag"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Note (optional)</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What's on your mind? Any context for how you're feeling..."
              className="text-sm resize-none dark:bg-neutral-900 dark:border-neutral-700"
              rows={2}
            />
          </div>

          {/* Save Button */}
          <div className="text-center">
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mb-2">Every log builds your streak</p>
          </div>
          <div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-neutral-900 hover:bg-neutral-800 text-white transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Heart className="h-4 w-4 mr-2" />
                  Log Mood
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Summary */}
      {weeklySummary && (
        <Card className="shadow-sm border-neutral-200 dark:border-neutral-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-red-500" />
              Weekly Summary
              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 ml-auto">
                {weeklySummary.daysTracked} days tracked
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{weeklySummary.avgMood}</p>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1">Avg Mood</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
                <p className="text-lg font-bold text-rose-600 dark:text-rose-400">{weeklySummary.avgEnergy}</p>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1">Avg Energy</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
                <p className="text-lg font-bold text-red-700 dark:text-red-500">{weeklySummary.avgFocus}</p>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1">Avg Focus</p>
              </div>
            </div>
            <div className="flex gap-3 text-[10px]">
              <div className="flex-1 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50">
                <p className="text-red-700 dark:text-red-400 font-medium">Best</p>
                <p className="text-neutral-600 dark:text-neutral-400 mt-0.5">{weeklySummary.bestDay}</p>
              </div>
              <div className="flex-1 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50">
                <p className="text-red-700 dark:text-red-400 font-medium">Toughest</p>
                <p className="text-neutral-600 dark:text-neutral-400 mt-0.5">{weeklySummary.worstDay}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 30-Day Heatmap Calendar */}
      <Card className="shadow-sm border-neutral-200 dark:border-neutral-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2 min-w-0">
              <CalendarDays className="h-4 w-4 text-red-500 shrink-0" />
              <span className="truncate">30-Day Mood History</span>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHeatmap(!showHeatmap)}
              className="h-7 w-7 p-0 shrink-0"
            >
              {showHeatmap ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {showHeatmap && (
          <CardContent className="animate-slow-fade-in">
            <div className="grid grid-cols-10 gap-1">
              {heatmapData.map(day => (
                <div
                  key={day.date}
                  className={`aspect-square rounded-sm ${getMoodColor(day.avgMood)} relative group cursor-default`}
                  title={`${day.dayLabel}: ${day.avgMood !== null ? `Mood ${day.avgMood} (${day.count} log${day.count > 1 ? 's' : ''})` : 'No data'}`}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                    <div className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-[9px] px-2 py-1 rounded whitespace-nowrap">
                      {day.dayLabel}{day.avgMood !== null ? `: ${day.avgMood}` : ': No data'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2 text-[9px] text-neutral-400 dark:text-neutral-500">
              <span>30 days ago</span>
              <div className="flex items-center gap-1">
                <span>Low</span>
                <div className="w-3 h-3 rounded-sm bg-red-800 dark:bg-red-700" />
                <div className="w-3 h-3 rounded-sm bg-red-600 dark:bg-red-500" />
                <div className="w-3 h-3 rounded-sm bg-rose-500 dark:bg-rose-400" />
                <div className="w-3 h-3 rounded-sm bg-red-500 dark:bg-red-400" />
                <div className="w-3 h-3 rounded-sm bg-red-400 dark:bg-red-300" />
                <span>High</span>
              </div>
              <span>Today</span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 7-Day Trend Chart */}
      {trendData.length > 0 && (
        <Card className="shadow-sm border-neutral-200 dark:border-neutral-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-red-500" />
              7-Day Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full h-52 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" className="dark:stroke-neutral-700" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#737373' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[1, 10]}
                    ticks={[1, 3, 5, 7, 10]}
                    tick={{ fontSize: 10, fill: '#737373' }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255,255,255,0.95)',
                      border: '1px solid #e5e5e5',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="mood"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#ef4444' }}
                    activeDot={{ r: 5 }}
                    name="Mood"
                  />
                  <Line
                    type="monotone"
                    dataKey="energy"
                    stroke="#dc2626"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#dc2626' }}
                    activeDot={{ r: 5 }}
                    name="Energy"
                  />
                  <Line
                    type="monotone"
                    dataKey="focus"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#f43f5e' }}
                    activeDot={{ r: 5 }}
                    name="Focus"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Logs */}
      <Card className="shadow-sm border-neutral-200 dark:border-neutral-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2 min-w-0">
              <Activity className="h-4 w-4 text-red-500 shrink-0" />
              <span className="truncate">Recent Logs</span>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRecent(!showRecent)}
              className="h-7 w-7 p-0 shrink-0"
            >
              {showRecent ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {showRecent && (
          <CardContent className="animate-slow-fade-in">
            {moodLogsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-red-500" />
              </div>
            ) : moodLogs.length === 0 ? (
              <div className="text-center py-8">
                <Heart className="h-8 w-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
                <p className="text-xs text-neutral-500 dark:text-neutral-400">No mood logs yet. Start tracking above!</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {moodLogs.map((log) => {
                  return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800"
                  >
                    <div className="shrink-0 mt-0.5 w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                      <span className={`text-xs font-bold ${log.mood <= 3 ? 'text-red-800' : log.mood <= 6 ? 'text-red-600' : 'text-red-400'}`}>{log.mood}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-neutral-900 dark:text-white">
                          {new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-xs text-neutral-400 dark:text-neutral-500 whitespace-nowrap">{log.time}</span>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                          Mood {log.mood}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
                          Energy {log.energy}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-500">
                          Focus {log.focus}
                        </Badge>
                      </div>
                      {log.note && (
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 truncate">{log.note}</p>
                      )}
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* AI Mood Insights */}
      <Card className="shadow-sm border-neutral-200 dark:border-neutral-800 border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2 min-w-0">
              <Sparkles className="h-4 w-4 text-red-500 shrink-0" />
              <span className="truncate">AI Mood Insights</span>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInsights(!showInsights)}
              className="h-7 w-7 p-0 shrink-0"
            >
              {showInsights ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {showInsights && (
          <CardContent className="animate-slow-fade-in">
            {insights.length === 0 ? (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Log your mood for at least 2 days to unlock AI-powered mood pattern insights.
              </p>
            ) : (
              <div className="space-y-2.5">
                {insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-neutral-700 dark:text-neutral-300">
                    <Lightbulb className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <span>{insight.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}➡️]+ ?/u, '')}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}
