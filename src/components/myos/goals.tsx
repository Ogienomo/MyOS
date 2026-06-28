'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { GoalsSkeleton } from './loading-skeleton'
import { SectionError } from './section-error'
import { useAppStore, Goal, Task } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  Target,
  Loader2,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  AlertCircle,
  Flag,
} from 'lucide-react'
import { AREA_CONFIG, AREA_KEYS as SHARED_AREA_KEYS, getAreaConfig } from '@/lib/area-config'

const areaConfig = AREA_CONFIG

const AREA_KEYS = SHARED_AREA_KEYS

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'Completed': return <CheckCircle2 className="h-4 w-4 text-neutral-600" />
    case 'In Progress': return <Clock className="h-4 w-4 text-rose-500" />
    default: return <Circle className="h-4 w-4 text-neutral-300" />
  }
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'Completed': return 'default'
    case 'In Progress': return 'secondary'
    default: return 'outline'
  }
}

// Frontend deduplication: filter out goals with identical titles within the same area
function deduplicateGoals(goals: Goal[]): { goals: Goal[]; duplicates: Goal[] } {
  const seen = new Map<string, Goal>()
  const deduped: Goal[] = []
  const duplicates: Goal[] = []

  for (const goal of goals) {
    const key = `${goal.area}:${goal.title.toLowerCase().trim()}`
    if (seen.has(key)) {
      duplicates.push(goal)
    } else {
      seen.set(key, goal)
      deduped.push(goal)
    }
  }

  return { goals: deduped, duplicates }
}

export function Goals() {
  const { goals, goalsLoading, setGoals, setGoalsLoading, lastSyncTimestamp, highlightItemId, highlightItemType, clearHighlightItem } = useAppStore()
  const { toast } = useToast()

  // ─── Highlight item from search navigation ─────────────────────────────
  useEffect(() => {
    if (!highlightItemId || highlightItemType !== 'goals') return

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
  const [selectedArea, setSelectedArea] = useState<string | null>(null)

  // Add Goal dialog
  const [addGoalOpen, setAddGoalOpen] = useState(false)
  const [newGoal, setNewGoal] = useState({ area: '', title: '', description: '' })
  const [addGoalError, setAddGoalError] = useState('')
  const [addGoalSubmitting, setAddGoalSubmitting] = useState(false)
  const [similarGoalWarning, setSimilarGoalWarning] = useState<string | null>(null)

  // Edit goal
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [editingGoalTitle, setEditingGoalTitle] = useState('')
  const [editingGoalDescription, setEditingGoalDescription] = useState('')
  const [editGoalError, setEditGoalError] = useState('')

  // Add Task
  const [addingTaskGoalId, setAddingTaskGoalId] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDifficulty, setNewTaskDifficulty] = useState('')
  const [addTaskError, setAddTaskError] = useState('')

  // Edit task
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTaskTitle, setEditingTaskTitle] = useState('')
  const [editTaskError, setEditTaskError] = useState('')

  // Per-area inline add goal
  const [inlineAddArea, setInlineAddArea] = useState<string | null>(null)
  const [inlineGoalTitle, setInlineGoalTitle] = useState('')
  const [inlineGoalDescription, setInlineGoalDescription] = useState('')
  const [inlineAddError, setInlineAddError] = useState('')
  const [inlineAddSubmitting, setInlineAddSubmitting] = useState(false)

  // Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showFeedback = useCallback((type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 3000)
  }, [])

  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchGoals = useCallback(async () => {
    try {
      setGoalsLoading(true)
      setFetchError(null)
      const res = await fetch('/api/goals')
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      setGoals(data.goals || [])
    } catch (err) {
      console.error('Failed to fetch goals:', err)
      setFetchError('Could not load goals. Check your connection and try again.')
    } finally {
      setGoalsLoading(false)
    }
  }, [setGoals, setGoalsLoading])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals, lastSyncTimestamp])

  const updateStatus = async (type: 'goal' | 'task', id: string, status: string) => {
    try {
      await fetch('/api/goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, status }),
      })
      await fetchGoals()
      toast({ title: 'Goal updated', description: 'Status has been changed.' })
    } catch (err) {
      console.error('Failed to update status:', err)
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' })
    }
  }

  // Create a new goal
  const createGoal = async () => {
    if (!newGoal.area || !newGoal.title.trim()) {
      setAddGoalError('Area and title are required')
      return
    }
    setAddGoalSubmitting(true)
    setAddGoalError('')
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area: newGoal.area,
          title: newGoal.title.trim(),
          description: newGoal.description.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && data.existingGoal) {
          setAddGoalError(data.error || 'A goal with this title already exists in this area')
        } else {
          setAddGoalError(data.error || 'Failed to create goal')
        }
        setAddGoalSubmitting(false)
        return
      }
      setAddGoalOpen(false)
      setNewGoal({ area: '', title: '', description: '' })
      setSimilarGoalWarning(null)
      await fetchGoals()
      showFeedback('success', 'Goal created successfully!')
      toast({ title: 'Goal created', description: 'Your new goal has been saved.' })
    } catch {
      setAddGoalError('Failed to create goal')
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' })
    } finally {
      setAddGoalSubmitting(false)
    }
  }

  // Create a goal inline for a specific area
  const createInlineGoal = async (area: string) => {
    if (!inlineGoalTitle.trim()) {
      setInlineAddError('Goal title is required')
      return
    }
    setInlineAddSubmitting(true)
    setInlineAddError('')
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area,
          title: inlineGoalTitle.trim(),
          description: inlineGoalDescription.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && data.existingGoal) {
          setInlineAddError(data.error || 'A goal with this title already exists in this area')
        } else {
          setInlineAddError(data.error || 'Failed to create goal')
        }
        setInlineAddSubmitting(false)
        return
      }
      setInlineAddArea(null)
      setInlineGoalTitle('')
      setInlineGoalDescription('')
      await fetchGoals()
      showFeedback('success', 'Goal created successfully!')
      toast({ title: 'Goal created', description: 'Your new goal has been saved.' })
    } catch {
      setInlineAddError('Failed to create goal')
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' })
    } finally {
      setInlineAddSubmitting(false)
    }
  }

  // Update a goal's details
  const saveGoalEdit = async (id: string) => {
    if (!editingGoalTitle.trim()) return
    setEditGoalError('')
    try {
      const res = await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          title: editingGoalTitle.trim(),
          description: editingGoalDescription.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setEditGoalError(data.error || 'Failed to update goal')
        return
      }
      setEditingGoalId(null)
      await fetchGoals()
      showFeedback('success', 'Goal updated!')
      toast({ title: 'Goal updated', description: 'Your changes have been saved.' })
    } catch {
      setEditGoalError('Failed to update goal')
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' })
    }
  }

  // Delete a goal
  const deleteGoal = async (id: string) => {
    try {
      await fetch(`/api/goals?type=goal&id=${id}`, { method: 'DELETE' })
      await fetchGoals()
      showFeedback('success', 'Goal deleted')
      toast({ title: 'Goal deleted', description: 'The goal has been removed.' })
    } catch {
      showFeedback('error', 'Failed to delete goal')
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' })
    }
  }

  // Create a new task
  const createTask = async (goalId: string) => {
    if (!newTaskTitle.trim()) {
      setAddTaskError('Task title is required')
      return
    }
    setAddTaskError('')
    try {
      const res = await fetch('/api/goals/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId,
          title: newTaskTitle.trim(),
          difficulty: newTaskDifficulty || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAddTaskError(data.error || 'Failed to create task')
        return
      }
      setNewTaskTitle('')
      setNewTaskDifficulty('')
      setAddingTaskGoalId(null)
      await fetchGoals()
      showFeedback('success', 'Task added!')
      toast({ title: 'Task added', description: 'New task has been created.' })
    } catch {
      setAddTaskError('Failed to create task')
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' })
    }
  }

  // Update a task's title
  const saveTaskEdit = async (id: string) => {
    if (!editingTaskTitle.trim()) return
    setEditTaskError('')
    try {
      const res = await fetch('/api/goals/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title: editingTaskTitle.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setEditTaskError(data.error || 'Failed to update task')
        return
      }
      setEditingTaskId(null)
      await fetchGoals()
      showFeedback('success', 'Task updated!')
      toast({ title: 'Task updated', description: 'Your changes have been saved.' })
    } catch {
      setEditTaskError('Failed to update task')
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' })
    }
  }

  // Delete a task
  const deleteTask = async (id: string) => {
    try {
      await fetch(`/api/goals/tasks?id=${id}`, { method: 'DELETE' })
      await fetchGoals()
      showFeedback('success', 'Task deleted')
      toast({ title: 'Task deleted', description: 'The task has been removed.' })
    } catch {
      showFeedback('error', 'Failed to delete task')
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' })
    }
  }

  // Check for similar goal titles when user types in add goal form
  const checkSimilarGoal = useCallback((title: string, area: string) => {
    if (!title.trim() || !area) {
      setSimilarGoalWarning(null)
      return
    }
    const normalizedTitle = title.toLowerCase().trim()
    const similar = goals.find(
      g => g.area === area && g.title.toLowerCase().trim() === normalizedTitle
    )
    if (similar) {
      setSimilarGoalWarning(`A goal "${similar.title}" already exists in this area.`)
    } else {
      setSimilarGoalWarning(null)
    }
  }, [goals])

  // Frontend deduplication
  const { goals: dedupedGoals, duplicates } = useMemo(() => deduplicateGoals(goals), [goals])

  if (goalsLoading && goals.length === 0) {
    return <GoalsSkeleton />
  }

  if (fetchError && goals.length === 0) {
    return <SectionError message={fetchError} onRetry={fetchGoals} />
  }

  // Group deduped goals by area
  const goalsByArea: Record<string, Goal[]> = {}
  for (const goal of dedupedGoals) {
    if (!goalsByArea[goal.area]) goalsByArea[goal.area] = []
    goalsByArea[goal.area].push(goal)
  }

  const areas = Object.keys(goalsByArea)
  const filteredAreas = selectedArea ? [selectedArea] : areas

  // Calculate overall stats from deduped goals
  const totalTasks = dedupedGoals.reduce((acc, g) => acc + g.tasks.length, 0)
  const completedTasks = dedupedGoals.reduce((acc, g) => acc + g.tasks.filter(t => t.status === 'Completed').length, 0)
  const inProgressTasks = dedupedGoals.reduce((acc, g) => acc + g.tasks.filter(t => t.status === 'In Progress').length, 0)
  const taskPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Feedback Toast */}
      {feedback && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          feedback.type === 'success' 
            ? 'bg-neutral-900 text-white' 
            : 'bg-neutral-800 text-white'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {feedback.message}
        </div>
      )}

      {/* Duplicate goals warning */}
      {duplicates.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-rose-700 font-medium">
              {duplicates.length} duplicate goal{duplicates.length > 1 ? 's' : ''} hidden
            </p>
            <p className="text-[10px] text-rose-600 mt-0.5">
              {duplicates.map(d => `"${d.title}"`).join(', ')} — already exists in the same area
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-neutral-800">Goals & Tasks</h2>
            <p className="text-xs text-neutral-500">{totalTasks} tasks across {dedupedGoals.length} goals</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl sm:text-2xl font-medium text-neutral-800">{taskPercent}%</p>
            <p className="text-[10px] text-neutral-400">completed</p>
          </div>
        </div>
        <Button
          onClick={() => {
            setAddGoalOpen(true)
            setAddGoalError('')
            setNewGoal({ area: '', title: '', description: '' })
            setSimilarGoalWarning(null)
          }}
          size="sm"
          className="w-full sm:w-auto sm:self-end bg-neutral-900 hover:bg-neutral-800 text-white gap-1.5 min-h-[44px]"
        >
          <Plus className="h-4 w-4" />
          Add Goal
        </Button>
      </div>

      {/* Area completion snapshot */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {AREA_KEYS.map(area => {
          const areaGoals = dedupedGoals.filter(g => g.area === area)
          const done = areaGoals.filter(g => g.status === 'Completed').length
          const total = areaGoals.length
          const pct = total > 0 ? Math.round((done / total) * 100) : 0
          return (
            <button
              key={area}
              onClick={() => setSelectedArea(selectedArea === area ? null : area)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-colors text-center ${selectedArea === area ? 'bg-neutral-900 border-neutral-900 text-white' : 'bg-white border-neutral-100 hover:border-neutral-300'}`}
            >
              <span className={`text-base font-bold ${selectedArea === area ? 'text-white' : pct === 100 ? 'text-red-600' : total === 0 ? 'text-neutral-300' : 'text-neutral-700'}`}>{total === 0 ? '—' : `${pct}%`}</span>
              <span className={`text-[9px] leading-tight font-medium ${selectedArea === area ? 'text-white/80' : 'text-neutral-500'}`}>{getAreaConfig(area).label}</span>
              {total > 0 && <span className={`text-[8px] ${selectedArea === area ? 'text-white/60' : 'text-neutral-400'}`}>{done}/{total}</span>}
            </button>
          )
        })}
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl border p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs text-neutral-500">Overall Progress</span>
          <span className="text-xs text-neutral-400">{completedTasks}/{totalTasks} tasks</span>
        </div>
        <Progress value={taskPercent} className="h-2 sm:h-3" />
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3">
          <span className="text-[10px] text-red-600 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> {completedTasks} completed
          </span>
          <span className="text-[10px] text-rose-500 flex items-center gap-1">
            <Clock className="h-3 w-3" /> {inProgressTasks} in progress
          </span>
          <span className="text-[10px] text-neutral-400 flex items-center gap-1">
            <Circle className="h-3 w-3" /> {totalTasks - completedTasks - inProgressTasks} not started
          </span>
        </div>
      </div>

      {/* Area Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
        <button
          onClick={() => setSelectedArea(null)}
          className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full transition-all shrink-0 min-h-[36px] ${
            !selectedArea
              ? 'bg-neutral-900 text-white font-medium'
              : 'bg-white text-neutral-600 hover:bg-neutral-50 border border-neutral-200'
          }`}
        >
          All Areas
        </button>
        {areas.map((area) => {
          const config = getAreaConfig(area)
          return (
            <button
              key={area}
              onClick={() => setSelectedArea(area)}
              className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full transition-all shrink-0 min-h-[36px] ${
                selectedArea === area
                  ? 'bg-neutral-900 text-white font-medium'
                  : 'bg-white text-neutral-600 hover:bg-neutral-50 border border-neutral-200'
              }`}
            >
              {config.label}
            </button>
          )
        })}
      </div>

      {/* Empty State */}
      {dedupedGoals.length === 0 && (
        <Card className="shadow-sm border-dashed border-2 border-neutral-200">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
              <Target className="h-8 w-8 text-neutral-400" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-800 mb-2">No goals yet</h3>
            <p className="text-sm text-neutral-500 max-w-sm mb-6">
              Every great vision starts with a single goal. Add your first goal and start building the life you&apos;re called to.
            </p>
            <Button
              onClick={() => {
                setAddGoalOpen(true)
                setAddGoalError('')
                setNewGoal({ area: '', title: '', description: '' })
                setSimilarGoalWarning(null)
              }}
              className="bg-neutral-900 hover:bg-neutral-800 text-white gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add Your First Goal
            </Button>
            <p className="text-[10px] text-neutral-400 mt-3">
              Or run <code className="bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-600">POST /api/seed</code> to load sample goals
            </p>
          </CardContent>
        </Card>
      )}

      {/* Goals by Area */}
      <div className="space-y-4">
        {filteredAreas.map((area) => {
          const config = getAreaConfig(area)
          const areaGoals = goalsByArea[area] || []
          const areaTasks = areaGoals.reduce((acc, g) => acc + g.tasks.length, 0)
          const areaCompleted = areaGoals.reduce((acc, g) => acc + g.tasks.filter(t => t.status === 'Completed').length, 0)
          const areaPercent = areaTasks > 0 ? Math.round((areaCompleted / areaTasks) * 100) : 0

          return (
            <Card key={area} className="shadow-sm">
              <CardHeader className="pb-3 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xs sm:text-sm font-medium">{config.label}</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{areaPercent}%</Badge>
                </div>
                <Progress value={areaPercent} className="h-1.5 mt-2.5" />
              </CardHeader>
              <CardContent className="pt-0 p-4 sm:p-6">
                <Accordion type="multiple" className="w-full">
                  {areaGoals.map((goal) => {
                    const goalCompleted = goal.tasks.filter(t => t.status === 'Completed').length
                    const goalPercent = goal.tasks.length > 0 ? Math.round((goalCompleted / goal.tasks.length) * 100) : 0
                    const isEditingGoal = editingGoalId === goal.id

                    return (
                      <AccordionItem key={goal.id} value={goal.id} id={`item-${goal.id}`} className={`border-neutral-100 ${highlightItemId === goal.id && highlightItemType === 'goals' ? 'ring-2 ring-rose-400 bg-rose-50 dark:bg-rose-950/30 animate-pulse rounded-lg' : ''}`}>
                        <AccordionTrigger className="py-2 sm:py-3 hover:no-underline">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3 text-left flex-1 min-w-0">
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const nextStatus = goal.status === 'Not Started' ? 'In Progress'
                                    : goal.status === 'In Progress' ? 'Completed'
                                    : goal.status === 'Completed' ? 'Not Started'
                                    : 'Not Started'
                                  updateStatus('goal', goal.id, nextStatus)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.stopPropagation()
                                    const nextStatus = goal.status === 'Not Started' ? 'In Progress'
                                      : goal.status === 'In Progress' ? 'Completed'
                                      : goal.status === 'Completed' ? 'Not Started'
                                      : 'Not Started'
                                    updateStatus('goal', goal.id, nextStatus)
                                  }
                                }}
                                className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                              >
                                <StatusIcon status={goal.status} />
                              </div>
                              <div className="flex-1 min-w-0">
                                {isEditingGoal ? (
                                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Input
                                      value={editingGoalTitle}
                                      onChange={(e) => setEditingGoalTitle(e.target.value)}
                                      className="h-7 text-sm py-0 px-2"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveGoalEdit(goal.id)
                                        if (e.key === 'Escape') setEditingGoalId(null)
                                      }}
                                      autoFocus
                                    />
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => saveGoalEdit(goal.id)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') saveGoalEdit(goal.id) }}
                                      className="p-1 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                    >
                                      <Check className="h-3.5 w-3.5 text-red-600" />
                                    </div>
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => { setEditingGoalId(null); setEditGoalError('') }}
                                      onKeyDown={(e) => { if (e.key === 'Enter') { setEditingGoalId(null); setEditGoalError('') } }}
                                      className="p-1 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                                    >
                                      <X className="h-3.5 w-3.5 text-neutral-400" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 group/title">
                                    <p className={`text-xs sm:text-sm font-medium line-clamp-2 ${goal.status === 'Completed' ? 'line-through text-neutral-400' : 'text-neutral-700'}`}>{goal.title}</p>
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setEditingGoalId(goal.id)
                                        setEditingGoalTitle(goal.title)
                                        setEditingGoalDescription(goal.description || '')
                                        setEditGoalError('')
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.stopPropagation()
                                          setEditingGoalId(goal.id)
                                          setEditingGoalTitle(goal.title)
                                          setEditingGoalDescription(goal.description || '')
                                          setEditGoalError('')
                                        }
                                      }}
                                      className="opacity-0 group-hover/title:opacity-100 transition-opacity p-0.5 hover:bg-red-50 rounded cursor-pointer"
                                    >
                                      <Pencil className="h-3 w-3 text-neutral-400" />
                                    </div>
                                  </div>
                                )}
                                {editGoalError && isEditingGoal && (
                                  <p className="text-[10px] text-red-600 mt-0.5">{editGoalError}</p>
                                )}
                                <p className="text-[10px] text-neutral-400">{goalCompleted}/{goal.tasks.length} tasks &bull; {goalPercent}%</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 pl-0 sm:pl-0 flex-wrap" onClick={(e) => e.stopPropagation()}>
                              {/* Mark Complete button */}
                              {goal.status !== 'Completed' && (
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => updateStatus('goal', goal.id, 'Completed')}
                                  onKeyDown={(e) => { if (e.key === 'Enter') updateStatus('goal', goal.id, 'Completed') }}
                                  className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 hover:bg-red-100 transition-colors min-h-[28px] cursor-pointer"
                                  title="Mark as Complete"
                                >
                                  <Flag className="h-2.5 w-2.5" />
                                  <span className="hidden sm:inline">Complete</span>
                                </div>
                              )}
                              <Badge
                                variant={statusBadgeVariant(goal.status)}
                                className="text-[9px] sm:text-[10px] cursor-pointer hover:opacity-80 transition-opacity px-1.5 sm:px-2.5"
                                onClick={() => {
                                  const nextStatus = goal.status === 'Not Started' ? 'In Progress'
                                    : goal.status === 'In Progress' ? 'Completed'
                                    : goal.status === 'Completed' ? 'Paused'
                                    : 'Not Started'
                                  updateStatus('goal', goal.id, nextStatus)
                                }}
                              >
                                {goal.status}
                              </Badge>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <div role="button" tabIndex={0} className="p-1 hover:bg-red-50 rounded transition-opacity min-h-[28px] min-w-[28px] flex items-center justify-center cursor-pointer sm:opacity-0 sm:group-hover/trigger:opacity-100">
                                    <Trash2 className="h-3 w-3 text-neutral-400 hover:text-red-600 transition-colors" />
                                  </div>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogDescription>
                                      Delete &ldquo;{goal.title}&rdquo;? This will also delete all {goal.tasks.length} task{goal.tasks.length !== 1 ? 's' : ''} in this goal. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteGoal(goal.id)}
                                      className="bg-red-600 hover:bg-red-700 text-white"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-1.5 pl-2 sm:pl-7">
                            {/* Goal description */}
                            {goal.description && !isEditingGoal && (
                              <p className="text-xs text-neutral-500 mb-2 italic">{goal.description}</p>
                            )}

                            {/* Tasks */}
                            {goal.tasks.map((task) => {
                              const isEditingTask = editingTaskId === task.id
                              return (
                                <div
                                  key={task.id}
                                  className="flex items-start gap-2 p-2.5 rounded-lg hover:bg-neutral-50 group"
                                >
                                  <button
                                    onClick={() => {
                                      const nextStatus = task.status === 'Not Started' ? 'In Progress'
                                        : task.status === 'In Progress' ? 'Completed' : 'Not Started'
                                      updateStatus('task', task.id, nextStatus)
                                    }}
                                    className="mt-0.5 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                                  >
                                    <StatusIcon status={task.status} />
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    {isEditingTask ? (
                                      <div className="flex items-center gap-1">
                                        <Input
                                          value={editingTaskTitle}
                                          onChange={(e) => setEditingTaskTitle(e.target.value)}
                                          className="h-6 text-xs py-0 px-2"
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') saveTaskEdit(task.id)
                                            if (e.key === 'Escape') { setEditingTaskId(null); setEditTaskError('') }
                                          }}
                                          autoFocus
                                        />
                                        <button
                                          onClick={() => saveTaskEdit(task.id)}
                                          className="p-1 hover:bg-red-50 rounded transition-colors"
                                        >
                                          <Check className="h-3 w-3 text-red-600" />
                                        </button>
                                        <button
                                          onClick={() => { setEditingTaskId(null); setEditTaskError('') }}
                                          className="p-1 hover:bg-neutral-100 rounded transition-colors"
                                        >
                                          <X className="h-3 w-3 text-neutral-400" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1 group/task">
                                        <p className={`text-xs ${task.status === 'Completed' ? 'line-through text-neutral-400' : 'text-neutral-700'}`}>
                                          {task.title}
                                        </p>
                                        <button
                                          onClick={() => {
                                            setEditingTaskId(task.id)
                                            setEditingTaskTitle(task.title)
                                            setEditTaskError('')
                                          }}
                                          className="opacity-0 group-hover/task:opacity-100 transition-opacity p-0.5 hover:bg-red-50 rounded"
                                        >
                                          <Pencil className="h-2.5 w-2.5 text-neutral-400" />
                                        </button>
                                      </div>
                                    )}
                                    {editTaskError && isEditingTask && (
                                      <p className="text-[10px] text-red-600 mt-0.5">{editTaskError}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                      {task.difficulty && (
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                                          task.difficulty === 'High' ? 'bg-rose-100 text-rose-600' :
                                          task.difficulty === 'Medium' ? 'bg-neutral-100 text-neutral-600' :
                                          'bg-neutral-100 text-neutral-600'
                                        }`}>
                                          {task.difficulty}
                                        </span>
                                      )}
                                      {task.estimatedCost && task.estimatedCost !== '0' && (
                                        <span className="text-[9px] text-neutral-400">₦{task.estimatedCost}</span>
                                      )}
                                      {task.status === 'Not Started' && !isEditingTask && (
                                        <button
                                          onClick={() => updateStatus('task', task.id, 'In Progress')}
                                          className="text-[9px] text-red-600 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          Start →
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {!isEditingTask && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-opacity mt-0.5">
                                          <Trash2 className="h-3 w-3 text-neutral-400 hover:text-red-600 transition-colors" />
                                        </button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogDescription>
                                            Delete task &ldquo;{task.title}&rdquo;? This cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => deleteTask(task.id)}
                                            className="bg-red-600 hover:bg-red-700 text-white"
                                          >
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                              )
                            })}

                            {/* Add Task */}
                            {addingTaskGoalId === goal.id ? (
                              <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-neutral-50 border border-neutral-200">
                                <Circle className="h-4 w-4 text-neutral-300 shrink-0" />
                                <Input
                                  placeholder="Task title..."
                                  value={newTaskTitle}
                                  onChange={(e) => { setNewTaskTitle(e.target.value); setAddTaskError('') }}
                                  className="h-7 text-xs py-0 px-2 flex-1 min-w-[120px] border-red-200 focus:border-red-400"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') createTask(goal.id)
                                    if (e.key === 'Escape') { setAddingTaskGoalId(null); setNewTaskTitle(''); setNewTaskDifficulty('') }
                                  }}
                                  autoFocus
                                />
                                <Select value={newTaskDifficulty} onValueChange={setNewTaskDifficulty}>
                                  <SelectTrigger className="h-7 text-[10px] w-24 border-red-200">
                                    <SelectValue placeholder="Difficulty" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Low">Low</SelectItem>
                                    <SelectItem value="Medium">Medium</SelectItem>
                                    <SelectItem value="High">High</SelectItem>
                                  </SelectContent>
                                </Select>
                                <button
                                  onClick={() => createTask(goal.id)}
                                  className="p-1.5 bg-neutral-900 hover:bg-neutral-800 rounded transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center"
                                >
                                  <Check className="h-3.5 w-3.5 text-white" />
                                </button>
                                <button
                                  onClick={() => { setAddingTaskGoalId(null); setNewTaskTitle(''); setNewTaskDifficulty('') }}
                                  className="p-1.5 hover:bg-neutral-200 rounded transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center"
                                >
                                  <X className="h-3.5 w-3.5 text-neutral-500" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setAddingTaskGoalId(goal.id)
                                  setNewTaskTitle('')
                                  setNewTaskDifficulty('')
                                  setAddTaskError('')
                                }}
                                className="flex items-center gap-1.5 text-[11px] text-neutral-600 hover:text-neutral-800 py-2 px-2 rounded-lg hover:bg-neutral-50 transition-colors min-h-[44px]"
                              >
                                <Plus className="h-3 w-3" /> Add Task
                              </button>
                            )}
                            {addTaskError && addingTaskGoalId === goal.id && (
                              <p className="text-[10px] text-red-600 ml-7">{addTaskError}</p>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>

                {/* Add New Goal inline at bottom of area */}
                {inlineAddArea === area ? (
                  <div className="mt-3 p-3 rounded-lg bg-neutral-50 border border-neutral-200">
                    <div className="space-y-2">
                      <Input
                        placeholder="Goal title..."
                        value={inlineGoalTitle}
                        onChange={(e) => {
                          setInlineGoalTitle(e.target.value)
                          setInlineAddError('')
                          // Check for similar goal
                          const normalized = e.target.value.toLowerCase().trim()
                          if (normalized) {
                            const similar = (goalsByArea[area] || []).find(
                              g => g.title.toLowerCase().trim() === normalized
                            )
                            if (similar) {
                              setInlineAddError(`A goal "${similar.title}" already exists in this area.`)
                            }
                          }
                        }}
                        className="h-8 text-sm border-red-200 focus:border-red-400"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') createInlineGoal(area)
                          if (e.key === 'Escape') {
                            setInlineAddArea(null)
                            setInlineGoalTitle('')
                            setInlineGoalDescription('')
                            setInlineAddError('')
                          }
                        }}
                        autoFocus
                      />
                      <Textarea
                        placeholder="Description (optional)"
                        value={inlineGoalDescription}
                        onChange={(e) => setInlineGoalDescription(e.target.value)}
                        className="text-xs border-red-200 focus:border-red-400 resize-none"
                        rows={2}
                      />
                      {inlineAddError && (
                        <div className="flex items-center gap-1.5 text-[10px] text-rose-700 bg-rose-50 px-2 py-1.5 rounded-md">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          {inlineAddError}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => createInlineGoal(area)}
                          disabled={inlineAddSubmitting || !inlineGoalTitle.trim()}
                          size="sm"
                          className="bg-neutral-900 hover:bg-neutral-800 text-white gap-1 h-7 text-xs"
                        >
                          {inlineAddSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                          Add Goal
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setInlineAddArea(null)
                            setInlineGoalTitle('')
                            setInlineGoalDescription('')
                            setInlineAddError('')
                          }}
                          className="h-7 text-xs text-neutral-500"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setInlineAddArea(area)
                      setInlineGoalTitle('')
                      setInlineGoalDescription('')
                      setInlineAddError('')
                    }}
                    className="mt-3 flex items-center gap-1.5 text-[11px] text-neutral-600 hover:text-neutral-800 py-2 px-3 rounded-lg hover:bg-neutral-50 transition-colors min-h-[44px]"
                  >
                    <Plus className="h-3 w-3" /> Add New Goal
                  </button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Add Goal Dialog */}
      <Dialog open={addGoalOpen} onOpenChange={setAddGoalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Target className="h-5 w-5" />
              Add New Goal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="goal-area" className="text-xs font-medium text-neutral-600">Life Area *</Label>
              <Select value={newGoal.area} onValueChange={(v) => { setNewGoal({ ...newGoal, area: v }); checkSimilarGoal(newGoal.title, v) }}>
                <SelectTrigger id="goal-area" className="border-neutral-200">
                  <SelectValue placeholder="Select a life area" />
                </SelectTrigger>
                <SelectContent>
                  {AREA_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {getAreaConfig(key).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-title" className="text-xs font-medium text-neutral-600">Goal Title *</Label>
              <Input
                id="goal-title"
                placeholder="e.g. Launch my online store"
                value={newGoal.title}
                onChange={(e) => { setNewGoal({ ...newGoal, title: e.target.value }); setAddGoalError(''); checkSimilarGoal(e.target.value, newGoal.area) }}
                className="border-neutral-200"
                onKeyDown={(e) => { if (e.key === 'Enter') createGoal() }}
              />
            </div>
            {similarGoalWarning && (
              <div className="flex items-center gap-1.5 text-[10px] text-rose-700 bg-rose-50 px-2 py-1.5 rounded-md">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {similarGoalWarning}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="goal-desc" className="text-xs font-medium text-neutral-600">Description (optional)</Label>
              <Textarea
                id="goal-desc"
                placeholder="What does achieving this goal look like?"
                value={newGoal.description}
                onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                className="border-neutral-200 resize-none"
                rows={3}
              />
            </div>
            {addGoalError && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {addGoalError}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setAddGoalOpen(false)}
              className="border-neutral-200"
            >
              Cancel
            </Button>
            <Button
              onClick={createGoal}
              disabled={addGoalSubmitting}
              className="bg-neutral-900 hover:bg-neutral-800 text-white gap-1.5"
            >
              {addGoalSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
