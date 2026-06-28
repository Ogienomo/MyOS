'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
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
  Repeat,
  Plus,
  X,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Flame,
  Loader2,
  Check,
  CheckCircle2,
  Circle,
  CalendarCheck,
} from 'lucide-react'
import { AREA_CONFIG, getAreaConfig, AREA_KEYS } from '@/lib/area-config'

// Types
interface HabitData {
  id: string
  title: string
  description: string | null
  area: string
  frequency: string
  customDays: string | null
  targetPerWeek: number | null
  color: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  currentStreak: number
  longestStreak: number
  completedToday: boolean
  scheduledToday: boolean
  weeklyProgress: number
  weeklyTarget: number
  last30Days: Array<{ date: string; completed: boolean }>
}

const AREA_COLORS: Record<string, string> = Object.fromEntries(
  AREA_KEYS.map(key => [key, AREA_CONFIG[key].color])
)
AREA_COLORS['general'] = 'bg-neutral-100 text-neutral-700'

const AREA_LABELS: Record<string, string> = Object.fromEntries(
  AREA_KEYS.map(key => [key, AREA_CONFIG[key].label])
)
AREA_LABELS['general'] = 'General'

const PRESET_COLORS = [
  '#ef4444', '#dc2626', '#f43f5e', '#b91c1c',
  '#e11d48', '#be123c', '#991b1b', '#fda4af',
]

const DAYS_OF_WEEK = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
]

function getFrequencyLabel(habit: HabitData): string {
  if (habit.frequency === 'daily') return 'Daily'
  if (habit.frequency === 'weekly') return `${habit.targetPerWeek || 1}x/week`
  if (habit.frequency === 'custom' && habit.customDays) {
    const days = JSON.parse(habit.customDays) as number[]
    return days.map((d) => DAYS_OF_WEEK.find((dw) => dw.value === d)?.label || '').filter(Boolean).join(', ')
  }
  return 'Custom'
}

export function Habits() {
  const [habits, setHabits] = useState<HabitData[]>([])
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingHabit, setEditingHabit] = useState<HabitData | null>(null)
  const [expandedHabit, setExpandedHabit] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formArea, setFormArea] = useState('general')
  const [formFrequency, setFormFrequency] = useState('daily')
  const [formCustomDays, setFormCustomDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [formTargetPerWeek, setFormTargetPerWeek] = useState(3)
  const [formColor, setFormColor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchHabits = useCallback(async () => {
    try {
      const res = await fetch('/api/habits?active=true')
      if (res.ok) {
        const data = await res.json()
        setHabits(data)
      }
    } catch (err) {
      console.error('Failed to fetch habits:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHabits()
  }, [fetchHabits])

  const resetForm = () => {
    setFormTitle('')
    setFormDescription('')
    setFormArea('general')
    setFormFrequency('daily')
    setFormCustomDays([1, 2, 3, 4, 5])
    setFormTargetPerWeek(3)
    setFormColor(null)
    setEditingHabit(null)
    setShowForm(false)
    setSaving(false)
  }

  const openEditForm = (habit: HabitData) => {
    setFormTitle(habit.title)
    setFormDescription(habit.description || '')
    setFormArea(habit.area)
    setFormFrequency(habit.frequency)
    setFormCustomDays(habit.customDays ? JSON.parse(habit.customDays) : [1, 2, 3, 4, 5])
    setFormTargetPerWeek(habit.targetPerWeek || 3)
    setFormColor(habit.color || null)
    setEditingHabit(habit)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formTitle.trim()) return
    setSaving(true)

    try {
      if (editingHabit) {
        // Update
        await fetch('/api/habits', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingHabit.id,
            title: formTitle.trim(),
            description: formDescription.trim() || null,
            area: formArea,
            frequency: formFrequency,
            customDays: formFrequency === 'custom' ? formCustomDays : null,
            targetPerWeek: formFrequency === 'weekly' ? formTargetPerWeek : null,
            color: formColor,
          }),
        })
      } else {
        // Create
        await fetch('/api/habits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formTitle.trim(),
            description: formDescription.trim() || null,
            area: formArea,
            frequency: formFrequency,
            customDays: formFrequency === 'custom' ? formCustomDays : null,
            targetPerWeek: formFrequency === 'weekly' ? formTargetPerWeek : null,
            color: formColor,
          }),
        })
      }

      resetForm()
      await fetchHabits()
      toast({ title: editingHabit ? 'Habit updated' : 'Habit created', description: editingHabit ? 'Your changes have been saved.' : 'Your new habit has been saved.' })
    } catch (err) {
      console.error('Failed to save habit:', err)
      toast({ title: 'Failed to update', description: 'Please try again.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/habits?id=${id}`, { method: 'DELETE' })
      setDeleteConfirmId(null)
      setExpandedHabit(null)
      await fetchHabits()
      toast({ title: 'Habit removed', description: 'The habit has been deleted.' })
    } catch (err) {
      console.error('Failed to delete habit:', err)
      toast({ title: 'Failed to update', description: 'Please try again.', variant: 'destructive' })
    }
  }

  const handleToggle = async (habitId: string) => {
    setTogglingId(habitId)
    try {
      const res = await fetch('/api/habits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habitId }),
      })
      if (res.ok) {
        const data = await res.json()
        toast({ title: data.completedToday ? 'Habit completed!' : 'Habit unmarked', description: data.completedToday ? 'Great work keeping it up!' : 'Completion has been undone.' })
        setHabits((prev) =>
          prev.map((h) =>
            h.id === habitId
              ? {
                  ...h,
                  completedToday: data.completedToday,
                  currentStreak: data.currentStreak,
                  longestStreak: data.longestStreak,
                }
              : h
          )
        )
      }
    } catch (err) {
      console.error('Failed to toggle habit:', err)
      toast({ title: 'Failed to update', description: 'Please try again.', variant: 'destructive' })
    } finally {
      setTogglingId(null)
    }
  }

  const toggleCustomDay = (day: number) => {
    setFormCustomDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort()
    )
  }

  // Heatmap rendering
  const renderHeatmap = (last30Days: Array<{ date: string; completed: boolean }>) => {
    // Arrange into 7 rows × ~5 columns (weeks)
    // Group by week starting Monday
    const weeks: Array<Array<{ date: string; completed: boolean }>> = []
    let currentWeek: Array<{ date: string; completed: boolean }> = []

    // Pad the beginning to align to Monday
    if (last30Days.length > 0) {
      const firstDay = new Date(last30Days[0].date).getDay()
      const firstDayOfWeek = firstDay === 0 ? 6 : firstDay - 1 // 0=Mon, 6=Sun
      for (let i = 0; i < firstDayOfWeek; i++) {
        currentWeek.push({ date: '', completed: false })
      }
    }

    for (const day of last30Days) {
      currentWeek.push(day)
      if (currentWeek.length === 7) {
        weeks.push(currentWeek)
        currentWeek = []
      }
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek)
    }

    return (
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day, di) => (
              <div
                key={`${wi}-${di}`}
                className={`w-3 h-3 rounded-sm ${
                  !day.date
                    ? 'bg-transparent'
                    : day.completed
                      ? 'bg-red-600'
                      : 'bg-neutral-200 dark:bg-neutral-700'
                }`}
                title={day.date || ''}
              />
            ))}
          </div>
        ))}
      </div>
    )
  }

  // Separate habits: today's scheduled habits
  const todayHabits = habits.filter((h) => h.scheduledToday)
  const completedHabits = todayHabits.filter((h) => h.completedToday)
  const uncompletedHabits = todayHabits.filter((h) => !h.completedToday)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Today's Habits */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <CalendarCheck className="h-4 w-4 text-red-600" />
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Today's Habits</h3>
          {todayHabits.length > 0 && (
            <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500">
              {completedHabits.length}/{todayHabits.length} done
            </span>
          )}
        </div>
        {todayHabits.length === 0 ? (
          <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center py-4">No habits scheduled today</p>
        ) : (
          <div className="space-y-2">
            {todayHabits.map((habit) => (
              <button
                key={habit.id}
                onClick={() => handleToggle(habit.id)}
                disabled={togglingId === habit.id}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left"
              >
                <div className="shrink-0">
                  {togglingId === habit.id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-red-400" />
                  ) : habit.completedToday ? (
                    <CheckCircle2 className="h-5 w-5 text-red-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-neutral-300 dark:text-neutral-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${habit.completedToday ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-neutral-800 dark:text-neutral-200'}`}>
                    {habit.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${AREA_COLORS[habit.area] || 'bg-neutral-100 text-neutral-600'}`}>
                      {AREA_LABELS[habit.area] || habit.area}
                    </span>
                    {habit.currentStreak > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-red-500 font-medium">
                        <Flame className="h-3 w-3" />
                        {habit.currentStreak}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Repeat className="h-5 w-5 text-red-600" />
            Habits
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">Build consistency, one day at a time</p>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="bg-red-600 hover:bg-red-700 text-white"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Habit
        </Button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="border-red-200 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-800">
                {editingHabit ? 'Edit Habit' : 'New Habit'}
              </h3>
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1.5 block">
                Title <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g., Morning prayer, Gym, Read 30 mins..."
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1.5 block">
                Description (optional)
              </label>
              <Textarea
                placeholder="What this habit means to you..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="text-sm min-h-[60px]"
              />
            </div>

            {/* Area */}
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Life Area</label>
              <Select value={formArea} onValueChange={setFormArea}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
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

            {/* Frequency */}
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Frequency</label>
              <Select value={formFrequency} onValueChange={setFormFrequency}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="custom">Custom Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Weekly: target per week */}
            {formFrequency === 'weekly' && (
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1.5 block">
                  How many times per week?
                </label>
                <Input
                  type="number"
                  min={1}
                  max={7}
                  value={formTargetPerWeek}
                  onChange={(e) => setFormTargetPerWeek(parseInt(e.target.value) || 1)}
                  className="text-sm w-24"
                />
              </div>
            )}

            {/* Custom: day selector */}
            {formFrequency === 'custom' && (
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-2 block">
                  Select days
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleCustomDay(day.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        formCustomDays.includes(day.value)
                          ? 'bg-red-600 text-white'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color picker */}
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-2 block">
                Color (optional)
              </label>
              <div className="flex gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormColor(formColor === c ? null : c)}
                    className={`w-7 h-7 rounded-full transition-all ${
                      formColor === c ? 'ring-2 ring-offset-2 ring-neutral-400 scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                {formColor && (
                  <button
                    type="button"
                    onClick={() => setFormColor(null)}
                    className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center"
                  >
                    <X className="h-3 w-3 text-neutral-500" />
                  </button>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={!formTitle.trim() || saving}
                className="bg-red-600 hover:bg-red-700 text-white flex-1"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                {editingHabit ? 'Update' : 'Create'} Habit
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {habits.length === 0 && !showForm && (
        <Card className="shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Repeat className="h-7 w-7 text-red-400" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-800 mb-1">No habits yet</h3>
            <p className="text-xs text-neutral-500 mb-4">
              Start building consistency with your first habit
            </p>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-red-600 hover:bg-red-700 text-white"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Your First Habit
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Today's Habits */}
      {todayHabits.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-800">Today&apos;s Habits</h3>
            <span className="text-xs text-neutral-500">
              {completedHabits.length}/{todayHabits.length} done
            </span>
          </div>

          {/* Uncompleted first */}
          {uncompletedHabits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              expanded={expandedHabit === habit.id}
              onToggle={() => handleToggle(habit.id)}
              onExpand={() => setExpandedHabit(expandedHabit === habit.id ? null : habit.id)}
              onEdit={() => openEditForm(habit)}
              onDelete={() => setDeleteConfirmId(habit.id)}
              toggling={togglingId === habit.id}
              renderHeatmap={renderHeatmap}
            />
          ))}

          {/* Completed */}
          {completedHabits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              expanded={expandedHabit === habit.id}
              onToggle={() => handleToggle(habit.id)}
              onExpand={() => setExpandedHabit(expandedHabit === habit.id ? null : habit.id)}
              onEdit={() => openEditForm(habit)}
              onDelete={() => setDeleteConfirmId(habit.id)}
              toggling={togglingId === habit.id}
              renderHeatmap={renderHeatmap}
            />
          ))}
        </div>
      )}

      {/* Weekly Progress section */}
      {habits.filter((h) => h.frequency === 'weekly').length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-neutral-800">Weekly Progress</h3>
          {habits
            .filter((h) => h.frequency === 'weekly')
            .map((habit) => (
              <Card key={habit.id} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-neutral-800">{habit.title}</span>
                    <span className="text-xs text-neutral-500">
                      {habit.weeklyProgress}/{habit.weeklyTarget} this week
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, (habit.weeklyProgress / Math.max(1, habit.weeklyTarget)) * 100)}
                    className="h-2"
                  />
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Habit?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this habit and all its log history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Habit Card sub-component
function HabitCard({
  habit,
  expanded,
  onToggle,
  onExpand,
  onEdit,
  onDelete,
  toggling,
  renderHeatmap,
}: {
  habit: HabitData
  expanded: boolean
  onToggle: () => void
  onExpand: () => void
  onEdit: () => void
  onDelete: () => void
  toggling: boolean
  renderHeatmap: (days: Array<{ date: string; completed: boolean }>) => React.ReactNode
}) {
  const accentColor = habit.color || '#dc2626'

  return (
    <Card
      className={`shadow-sm transition-all ${
        habit.completedToday
          ? 'border-red-200 bg-red-50/50'
          : 'border-neutral-200'
      }`}
    >
      <CardContent className="p-4">
        {/* Main row */}
        <div className="flex items-center gap-3">
          {/* Checkbox */}
          <button
            onClick={onToggle}
            disabled={toggling}
            className="shrink-0 transition-transform active:scale-90"
          >
            {toggling ? (
              <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
            ) : (
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  habit.completedToday
                    ? 'bg-red-600 border-red-500'
                    : 'border-neutral-300 hover:border-neutral-400'
                }`}
              >
                {habit.completedToday && <Check className="h-3 w-3 text-white" />}
              </div>
            )}
          </button>

          {/* Title + area */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-medium truncate ${
                  habit.completedToday
                    ? 'line-through text-neutral-400'
                    : 'text-neutral-800'
                }`}
              >
                {habit.title}
              </span>
              <Badge
                variant="secondary"
                className={`text-[10px] px-1.5 py-0 shrink-0 ${AREA_COLORS[habit.area] || AREA_COLORS.general}`}
              >
                {AREA_LABELS[habit.area] || habit.area}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-neutral-400">
                {getFrequencyLabel(habit)}
              </span>
              {habit.currentStreak > 0 && (
                <span className="text-[10px] flex items-center gap-0.5 text-rose-600">
                  <Flame className="h-3 w-3" /> {habit.currentStreak}
                </span>
              )}
            </div>
          </div>

          {/* Expand button */}
          <button
            onClick={onExpand}
            className="shrink-0 p-1 rounded hover:bg-neutral-100 transition-colors"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-neutral-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-neutral-400" />
            )}
          </button>
        </div>

        {/* Weekly mini progress for non-weekly too */}
        {habit.frequency !== 'weekly' && habit.scheduledToday && (
          <div className="mt-2 pl-8">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (habit.weeklyProgress / Math.max(1, habit.weeklyTarget)) * 100)}%`,
                    backgroundColor: accentColor,
                    opacity: 0.6,
                  }}
                />
              </div>
              <span className="text-[10px] text-neutral-400">
                {habit.weeklyProgress}/{habit.weeklyTarget}
              </span>
            </div>
          </div>
        )}

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-neutral-100 space-y-3">
            {/* 30-day heatmap */}
            <div>
              <p className="text-[10px] font-medium text-neutral-500 mb-2">Last 30 days</p>
              {renderHeatmap(habit.last30Days)}
            </div>

            {/* Streak info */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-lg font-bold text-neutral-800">{habit.currentStreak}</p>
                <p className="text-[10px] text-neutral-500 mt-0.5">Current</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-neutral-800">{habit.longestStreak}</p>
                <p className="text-[10px] text-neutral-500 mt-0.5">Longest</p>
              </div>
              {habit.currentStreak > 0 && (
                <div className="flex items-center gap-1 ml-auto">
                  <Flame className="h-4 w-4 text-red-500" />
                  <span className="text-xs font-medium text-red-600">
                    {habit.currentStreak} day streak!
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            {habit.description && (
              <p className="text-xs text-neutral-500 leading-relaxed">{habit.description}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                className="text-xs h-7"
              >
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-xs h-7 text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
