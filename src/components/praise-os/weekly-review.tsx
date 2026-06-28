'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  CalendarCheck, ChevronLeft, ChevronRight, Target, Wallet, Heart,
  Zap, Brain, Loader2, TrendingUp, TrendingDown, Minus, BookOpen,
  ClipboardCheck, Repeat, Sparkles, Flame, Lightbulb,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar,
} from 'recharts'

interface WeekScores {
  faith: number
  health: number
  career: number
  havilah: number
  finances: number
  relationships: number
  personalGrowth: number
  overall: number
}

interface WeekData {
  scores: WeekScores
  completedGoals: { id: string; title: string; area: string }[]
  inProgressGoals: { id: string; title: string; area: string; status: string }[]
  finances: { received: number; spent: number; net: number; topCategories: { category: string; amount: number }[] }
  moodAvg: { mood: number; energy: number; focus: number }
  moodTrend: { date: string; mood: number; energy: number; focus: number }[]
  habitsCompleted: { completed: number; total: number; rate: number }
  checkInsCompleted: string[]
  journalEntries: number
  memories: { type: string; content: string; area: string }[]
}

interface ReviewData {
  thisWeek: WeekData
  lastWeek: WeekData
  scoreChanges: Record<string, number>
  weekGrade: string
  weekComment: string
  weekStart: string
  weekEnd: string
  reviewNote: { whatILearned: string | null; nextWeekFocus: string | null } | null
}

const AREA_LABELS: Record<string, string> = {
  faith: 'Faith',
  health: 'Health',
  career: 'Career',
  havilah: 'Havilah',
  finances: 'Finances',
  relationships: 'Relationships',
  personalGrowth: 'Growth',
  overall: 'Overall',
}

const AREA_ICONS: Record<string, React.ReactNode> = {
  faith: <Heart className="h-3.5 w-3.5" />,
  health: <Zap className="h-3.5 w-3.5" />,
  career: <Target className="h-3.5 w-3.5" />,
  havilah: <Flame className="h-3.5 w-3.5" />,
  finances: <Wallet className="h-3.5 w-3.5" />,
  relationships: <Heart className="h-3.5 w-3.5" />,
  personalGrowth: <Sparkles className="h-3.5 w-3.5" />,
  overall: <Lightbulb className="h-3.5 w-3.5" />,
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const sStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const eStr = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${sStr} - ${eStr}`
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function getGradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700'
  if (grade.startsWith('B')) return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700'
  if (grade.startsWith('C')) return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-700'
  if (grade.startsWith('D')) return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700'
  return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700'
}

function formatCurrency(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function WeeklyReview() {
  const [data, setData] = useState<ReviewData | null>(null)
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [currentWeekStart, setCurrentWeekStart] = useState<string>(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    now.setDate(diff)
    return now.toISOString().split('T')[0]
  })

  // Notes state
  const [whatILearned, setWhatILearned] = useState('')
  const [nextWeekFocus, setNextWeekFocus] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchReview = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/weekly-review?date=${currentWeekStart}`)
      if (res.ok) {
        const reviewData = await res.json()
        setData(reviewData)
        if (reviewData.reviewNote) {
          setWhatILearned(reviewData.reviewNote.whatILearned || '')
          setNextWeekFocus(reviewData.reviewNote.nextWeekFocus || '')
        } else {
          setWhatILearned('')
          setNextWeekFocus('')
        }
      }
    } catch (err) {
      console.error('Failed to fetch weekly review:', err)
    } finally {
      setLoading(false)
    }
  }, [currentWeekStart])

  useEffect(() => {
    fetchReview()
  }, [fetchReview])

  const navigateWeek = (direction: -1 | 1) => {
    const d = new Date(currentWeekStart + 'T00:00:00')
    d.setDate(d.getDate() + direction * 7)
    setCurrentWeekStart(d.toISOString().split('T')[0])
  }

  // Debounced auto-save notes
  const saveNotes = useCallback(async (learned: string, focus: string) => {
    setSavingNotes(true)
    try {
      await fetch('/api/weekly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart: currentWeekStart, whatILearned: learned, nextWeekFocus: focus }),
      })
      toast({ title: 'Review saved', description: 'Your weekly notes have been saved.' })
    } catch (err) {
      console.error('Failed to save notes:', err)
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' })
    } finally {
      setSavingNotes(false)
    }
  }, [currentWeekStart])

  const handleNoteChange = (field: 'learned' | 'focus', value: string) => {
    if (field === 'learned') setWhatILearned(value)
    else setNextWeekFocus(value)

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      const learned = field === 'learned' ? value : whatILearned
      const focus = field === 'focus' ? value : nextWeekFocus
      saveNotes(learned, focus)
    }, 1500)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <CalendarCheck className="h-12 w-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
        <p className="text-sm text-neutral-500">No data available for this week.</p>
      </div>
    )
  }

  const { thisWeek, lastWeek, scoreChanges, weekGrade, weekComment } = data
  const areas = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-red-500" />
          Weekly Review
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Reflect on your week, track progress, and plan ahead</p>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigateWeek(-1)} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Previous Week
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">
            {formatDateRange(data.weekStart, data.weekEnd)}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigateWeek(1)} className="gap-1">
          Next Week <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* AI Week Grade */}
      <Card className="shadow-sm border-neutral-200 dark:border-neutral-800">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className={`text-3xl font-black px-4 py-2 rounded-xl border ${getGradeColor(weekGrade)}`}>
              {weekGrade}
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">Week Grade</p>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{weekComment}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grade Rubric */}
      <div className="grid grid-cols-5 gap-1.5">
        {[
          { grade: 'A', label: '≥90% goals, all check-ins', color: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300' },
          { grade: 'B', label: '75%+ goals, most check-ins', color: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300' },
          { grade: 'C', label: '60%+ goals, some check-ins', color: 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400' },
          { grade: 'D', label: 'Below 60%, few check-ins', color: 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-500' },
          { grade: 'F', label: 'Missed most commitments', color: 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-600' },
        ].map(({ grade, label, color }) => (
          <div key={grade} className={`rounded-xl border p-2 text-center ${color} ${weekGrade.startsWith(grade) ? 'ring-2 ring-red-400 dark:ring-red-600' : 'opacity-60'}`}>
            <p className="text-base font-black">{grade}</p>
            <p className="text-[9px] leading-tight mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Score Comparison */}
      <Card className="shadow-sm border-neutral-200 dark:border-neutral-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-red-500" />
            Score Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {areas.map(area => {
              const tw = Math.round(thisWeek.scores[area as keyof WeekScores])
              const lw = Math.round(lastWeek.scores[area as keyof WeekScores])
              const change = scoreChanges[area]
              const isUp = change > 0
              const isDown = change < 0
              return (
                <div key={area} className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    {AREA_ICONS[area]}
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{AREA_LABELS[area]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400">{lw}</span>
                    <span className="text-neutral-300">→</span>
                    <span className="text-sm font-bold text-neutral-900 dark:text-white">{tw}</span>
                    {change !== 0 && (
                      <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${
                        isUp ? 'text-red-600 dark:text-red-400' : isDown ? 'text-red-800 dark:text-red-500' : 'text-neutral-400'
                      }`}>
                        {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {change > 0 ? '+' : ''}{change}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {/* Overall */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-3.5 w-3.5 text-red-500" />
                <span className="text-xs font-semibold text-red-700 dark:text-red-400">Overall</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400">{Math.round(lastWeek.scores.overall)}</span>
                <span className="text-neutral-300">→</span>
                <span className="text-sm font-bold text-red-700 dark:text-red-400">{Math.round(thisWeek.scores.overall)}</span>
                {scoreChanges.overall !== 0 && (
                  <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${
                    scoreChanges.overall > 0 ? 'text-red-600 dark:text-red-400' : 'text-red-800 dark:text-red-500'
                  }`}>
                    {scoreChanges.overall > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {scoreChanges.overall > 0 ? '+' : ''}{scoreChanges.overall}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Week Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Goals */}
        <Card className="shadow-sm border-neutral-200 dark:border-neutral-800">
          <CardContent className="p-4 text-center">
            <Target className="h-5 w-5 text-red-500 mx-auto mb-1.5" />
            <p className="text-lg font-bold text-neutral-900 dark:text-white">{thisWeek.completedGoals.length}</p>
            <p className="text-[10px] text-neutral-500 mt-1">Goals completed</p>
            {thisWeek.inProgressGoals.length > 0 && (
              <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5">{thisWeek.inProgressGoals.length} in progress</p>
            )}
          </CardContent>
        </Card>

        {/* Finances */}
        <Card className="shadow-sm border-neutral-200 dark:border-neutral-800">
          <CardContent className="p-4 text-center">
            <Wallet className="h-5 w-5 text-red-500 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-red-600 dark:text-red-400">{formatCurrency(thisWeek.finances.received)} in</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{formatCurrency(thisWeek.finances.spent)} out</p>
            <p className={`text-[10px] font-semibold mt-1 ${thisWeek.finances.net >= 0 ? 'text-red-600' : 'text-red-800'}`}>
              Net: {formatCurrency(thisWeek.finances.net)}
            </p>
          </CardContent>
        </Card>

        {/* Mood */}
        <Card className="shadow-sm border-neutral-200 dark:border-neutral-800">
          <CardContent className="p-4 text-center">
            <Heart className="h-5 w-5 text-red-500 mx-auto mb-1.5" />
            <p className="text-lg font-bold text-neutral-900 dark:text-white">{thisWeek.moodAvg.mood}/10</p>
            <p className="text-[10px] text-neutral-500 mt-1">Avg Mood</p>
            {thisWeek.moodAvg.mood > lastWeek.moodAvg.mood ? (
              <p className="text-[10px] text-red-600 mt-0.5">↑ vs last week</p>
            ) : thisWeek.moodAvg.mood < lastWeek.moodAvg.mood ? (
              <p className="text-[10px] text-red-800 mt-0.5">↓ vs last week</p>
            ) : (
              <p className="text-[10px] text-neutral-400 mt-0.5">— vs last week</p>
            )}
          </CardContent>
        </Card>

        {/* Habits */}
        <Card className="shadow-sm border-neutral-200 dark:border-neutral-800">
          <CardContent className="p-4 text-center">
            <Repeat className="h-5 w-5 text-rose-500 mx-auto mb-1.5" />
            <p className="text-lg font-bold text-neutral-900 dark:text-white">{Math.round(thisWeek.habitsCompleted.rate * 100)}%</p>
            <p className="text-[10px] text-neutral-500 mt-1">Habit completion</p>
            <p className="text-[10px] text-neutral-400 mt-0.5">{thisWeek.habitsCompleted.completed}/{thisWeek.habitsCompleted.total}</p>
          </CardContent>
        </Card>

        {/* Journal */}
        <Card className="shadow-sm border-neutral-200 dark:border-neutral-800">
          <CardContent className="p-4 text-center">
            <BookOpen className="h-5 w-5 text-rose-500 mx-auto mb-1.5" />
            <p className="text-lg font-bold text-neutral-900 dark:text-white">{thisWeek.journalEntries}</p>
            <p className="text-[10px] text-neutral-500 mt-1">Journal entries</p>
          </CardContent>
        </Card>

        {/* Check-ins */}
        <Card className="shadow-sm border-neutral-200 dark:border-neutral-800">
          <CardContent className="p-4 text-center">
            <ClipboardCheck className="h-5 w-5 text-red-600 mx-auto mb-1.5" />
            <p className="text-lg font-bold text-neutral-900 dark:text-white">{thisWeek.checkInsCompleted.length}</p>
            <p className="text-[10px] text-neutral-500 mt-1">Check-in types</p>
            <p className="text-[10px] text-neutral-400 truncate mt-0.5">{thisWeek.checkInsCompleted.join(', ') || 'None'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Mood & Energy Trend */}
      {thisWeek.moodTrend.length > 0 && (
        <Card className="shadow-sm border-neutral-200 dark:border-neutral-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-red-500" />
              Mood & Energy Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full h-48 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={thisWeek.moodTrend.map(d => ({ ...d, date: formatShortDate(d.date) }))} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" className="dark:stroke-neutral-700" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#737373' }} tickLine={false} />
                  <YAxis domain={[1, 10]} ticks={[1, 3, 5, 7, 10]} tick={{ fontSize: 10, fill: '#737373' }} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #e5e5e5', borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="mood" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} name="Mood" />
                  <Line type="monotone" dataKey="energy" stroke="#dc2626" strokeWidth={2} dot={{ r: 3, fill: '#dc2626' }} name="Energy" />
                  <Line type="monotone" dataKey="focus" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3, fill: '#f43f5e' }} name="Focus" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Summary */}
      <Card className="shadow-sm border-neutral-200 dark:border-neutral-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <Wallet className="h-4 w-4 text-red-500" />
            Financial Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Income vs Spending bars */}
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-[10px] mb-1.5">
                <span className="text-red-600 dark:text-red-400 font-medium">Income</span>
                <span className="text-neutral-600 dark:text-neutral-400">{formatCurrency(thisWeek.finances.received)}</span>
              </div>
              <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (thisWeek.finances.received / Math.max(thisWeek.finances.received, thisWeek.finances.spent, 1)) * 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[10px] mb-1.5">
                <span className="text-red-600 dark:text-red-400 font-medium">Spending</span>
                <span className="text-neutral-600 dark:text-neutral-400">{formatCurrency(thisWeek.finances.spent)}</span>
              </div>
              <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (thisWeek.finances.spent / Math.max(thisWeek.finances.received, thisWeek.finances.spent, 1)) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Top spending categories */}
          {thisWeek.finances.topCategories.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-2">Top Spending Categories</p>
              <div className="space-y-1.5">
                {thisWeek.finances.topCategories.map(cat => (
                  <div key={cat.category} className="flex items-center justify-between text-xs">
                    <span className="text-neutral-700 dark:text-neutral-300">{cat.category}</span>
                    <span className="font-medium text-neutral-900 dark:text-white">{formatCurrency(cat.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Memories This Week */}
      {thisWeek.memories.length > 0 && (
        <Card className="shadow-sm border-neutral-200 dark:border-neutral-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-red-500" />
              Memories This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {thisWeek.memories.map((mem, i) => (
                <div key={i} className="flex items-start gap-2 text-xs p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">{mem.type}</Badge>
                  <span className="text-neutral-700 dark:text-neutral-300 leading-snug">{mem.content}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* What I Learned + Next Week Focus */}
      <Card className="shadow-sm border-neutral-200 dark:border-neutral-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-red-500" />
            Reflection & Planning
            {savingNotes && <Loader2 className="h-3 w-3 animate-spin text-neutral-400 ml-auto" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">What I Learned This Week</label>
            <Textarea
              value={whatILearned}
              onChange={(e) => handleNoteChange('learned', e.target.value)}
              placeholder="Reflect on your key learnings, wins, and challenges..."
              className="text-sm resize-none dark:bg-neutral-900 dark:border-neutral-700"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Next Week Focus</label>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] text-red-600 hover:text-red-700 px-2"
                onClick={() => {
                  const areas7 = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth'] as const
                  const lowestAreas = areas7
                    .map(a => ({ area: a, score: thisWeek.scores[a] }))
                    .sort((x, y) => x.score - y.score)
                    .slice(0, 3)
                    .map(a => `${AREA_LABELS[a.area]} (${a.score}/10)`)
                  const missedCheckins = ['morning', 'midday', 'evening'].filter(c => !thisWeek.checkInsCompleted.includes(c))
                  const lines = [
                    `Focus areas needing attention: ${lowestAreas.join(', ')}.`,
                    missedCheckins.length > 0 ? `Commit to ${missedCheckins.join(' & ')} check-ins daily.` : 'Maintain all daily check-ins.',
                    thisWeek.habitsCompleted.rate < 80 ? `Push habit completion above 80% (currently ${Math.round(thisWeek.habitsCompleted.rate)}%).` : 'Sustain strong habit consistency.',
                  ]
                  setNextWeekFocus(lines.join('\n'))
                  handleNoteChange('focus', lines.join('\n'))
                }}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Auto-generate
              </Button>
            </div>
            <Textarea
              value={nextWeekFocus}
              onChange={(e) => handleNoteChange('focus', e.target.value)}
              placeholder="What do you want to focus on next week?"
              className="text-sm resize-none dark:bg-neutral-900 dark:border-neutral-700"
              rows={3}
            />
          </div>
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Auto-saves as you type</p>
        </CardContent>
      </Card>
    </div>
  )
}
