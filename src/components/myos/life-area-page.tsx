'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  PenLine,
  X,
  Send,
  Sparkles,
  BookOpen,
  Target,
  TrendingUp,
  MessageCircle,
  Eye,
  Lightbulb,
  CalendarDays,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { useAppStore, Goal, LifeAreaProgress, JournalEntry, LifeScore, MonthlySummary } from '@/lib/store'
import { VoiceNoteButton } from './use-voice-note'

// ─── Area Configuration Type ───────────────────────────────────────────────

export interface AreaConfig {
  id: string
  label: string
  emoji: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  gradient: string
  accentColor: string
  description: string
  idealVision: string
  promptPrefix: string
}

// ─── Color Mapping Helper ──────────────────────────────────────────────────

const STROKE_COLORS: Record<string, string> = {
  red: 'stroke-red-500',
  rose: 'stroke-rose-500',
}

const CHART_COLORS: Record<string, string> = {
  red: '#dc2626',
  rose: '#f43f5e',
}

const BG_COLORS: Record<string, string> = {
  red: 'bg-red-600',
  rose: 'bg-rose-500',
}

const TEXT_COLORS: Record<string, string> = {
  red: 'text-red-600',
  rose: 'text-rose-600',
}

const LIGHT_BG_COLORS: Record<string, string> = {
  red: 'bg-red-50',
  rose: 'bg-rose-50',
}

// ─── Today's Commitment Card ───────────────────────────────────────────────

const COMMITMENT_KEY = (area: string) => `myos-commitment-${area}-${new Date().toDateString()}`

function TodayCommitmentCard({ area, color, accentColor }: { area: string; color: string; accentColor: string }) {
  const [commitment, setCommitment] = useState('')
  const [saved, setSaved] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(COMMITMENT_KEY(area))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is not available during SSR; reading in an effect and setting state is the correct pattern here.
    if (stored) { setCommitment(stored); setSaved(true) }
    else setEditing(true)
  }, [area])

  const handleSave = () => {
    if (!commitment.trim()) return
    localStorage.setItem(COMMITMENT_KEY(area), commitment.trim())
    setSaved(true)
    setEditing(false)
  }

  return (
    <div className={`rounded-2xl border p-4 bg-white dark:bg-neutral-900 shadow-sm`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target className={`h-4 w-4 ${TEXT_COLORS[color] || 'text-red-600'}`} />
          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Today&apos;s Commitment</span>
        </div>
        {saved && !editing && (
          <button onClick={() => setEditing(true)} className="text-[10px] text-neutral-400 hover:text-neutral-600 transition-colors">Edit</button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Input
            value={commitment}
            onChange={e => setCommitment(e.target.value)}
            placeholder={`What will you do for your ${area} today?`}
            className="text-sm h-9"
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <button
            onClick={handleSave}
            disabled={!commitment.trim()}
            className={`w-full py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-40 ${BG_COLORS[color] || 'bg-red-600'} hover:opacity-90`}
          >
            Set Commitment
          </button>
        </div>
      ) : (
        <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-snug">{commitment}</p>
      )}
    </div>
  )
}

// ─── Score Circle Component ────────────────────────────────────────────────

function ScoreCircle({ score, color, size = 'lg' }: { score: number; color: string; size?: 'sm' | 'lg' }) {
  const r = size === 'lg' ? 44 : 30
  const circumference = 2 * Math.PI * r
  const strokeDashoffset = circumference - (score / 10) * circumference
  const svgSize = size === 'lg' ? 120 : 80

  return (
    <div className="relative" style={{ width: svgSize, height: svgSize }}>
      <svg className="-rotate-90" width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={size === 'lg' ? 8 : 6}
          className="text-neutral-100"
        />
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={r}
          fill="none"
          strokeWidth={size === 'lg' ? 8 : 6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={STROKE_COLORS[color] || 'stroke-red-500'}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`${size === 'lg' ? 'text-3xl' : 'text-xl'} font-bold text-neutral-800`}>{score}</span>
      </div>
    </div>
  )
}

// ─── Mood Selector ─────────────────────────────────────────────────────────

const MOODS = [
  { value: 'great', label: 'Great' },
  { value: 'good', label: 'Good' },
  { value: 'okay', label: 'Okay' },
  { value: 'low', label: 'Low' },
  { value: 'struggling', label: 'Struggling' },
]

function MoodSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      {MOODS.map((mood) => (
        <button
          key={mood.value}
          type="button"
          onClick={() => onChange(mood.value)}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
            value === mood.value
              ? 'border-red-400 bg-red-50 shadow-sm'
              : 'border-neutral-200 hover:border-neutral-300 bg-white'
          }`}
        >
          <span className="text-[10px] font-medium text-neutral-600">{mood.label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────

export function LifeAreaPage({ config }: { config: AreaConfig }) {
  const { setActiveTab } = useAppStore()
  const IconComponent = config.icon

  // ── State ──
  const [loading, setLoading] = useState(true)
  const [currentScore, setCurrentScore] = useState(0)
  const [scoreTrend, setScoreTrend] = useState<Array<{ date: string; score: number }>>([])
  const [progress, setProgress] = useState<LifeAreaProgress | null>(null)
  const [showProgressForm, setShowProgressForm] = useState(false)
  const [goals, setGoals] = useState<Goal[]>([])
  const [driftAlerts, setDriftAlerts] = useState<Array<{ id: string; severity: string; message: string; date: string }>>([])
  const [memories, setMemories] = useState<Array<{ id: string; type: string; content: string; date: string }>>([])
  const [journals, setJournals] = useState<JournalEntry[]>([])
  const [showJournalForm, setShowJournalForm] = useState(false)
  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [aiInsightLoading, setAiInsightLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTabInner, setActiveTabInner] = useState('overview')

  // AI Coach state
  const [coachMessages, setCoachMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string }>>([])
  const [coachInput, setCoachInput] = useState('')
  const [coachLoading, setCoachLoading] = useState(false)
  const coachScrollRef = useRef<HTMLDivElement>(null)

  // Monthly Summary state
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([])
  const [currentMonthSummary, setCurrentMonthSummary] = useState<MonthlySummary | null>(null)
  const [summaryGenerating, setSummaryGenerating] = useState(false)
  const [expandedSummary, setExpandedSummary] = useState<string | null>(null)

  // Progress form state
  const [progressForm, setProgressForm] = useState({
    currentStatus: '',
    idealVision: '',
    keyActions: '',
    blockers: '',
    motivation: '',
  })

  // Journal form state
  const [journalForm, setJournalForm] = useState({
    title: '',
    content: '',
    mood: '',
    tags: '',
  })

  // ── Fetch all data ──
  const fetchAllData = useCallback(async () => {
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      // Fetch scores
      const scoresRes = await fetch(`/api/scores?from=${twoWeeksAgo}&to=${today}`)
      const scoresData = await scoresRes.json()
      const scores: LifeScore[] = scoresData.scores || []

      // Today's score for this area
      const todayScore = scores.find((s: LifeScore) => s.date === today)
      if (todayScore) {
        setCurrentScore(todayScore[config.id as keyof LifeScore] as number || 0)
      } else if (scores.length > 0) {
        setCurrentScore(scores[0][config.id as keyof LifeScore] as number || 0)
      }

      // Score trend for 14 days
      const trend = scores
        .reverse()
        .map((s: LifeScore) => ({ date: s.date.slice(5), score: s[config.id as keyof LifeScore] as number || 0 }))
      setScoreTrend(trend)

      // Fetch life area progress
      const progressRes = await fetch(`/api/life-area?area=${config.id}`)
      const progressData = await progressRes.json()
      const records = progressData.records || []
      if (records.length > 0) {
        setProgress(records[0])
        setProgressForm({
          currentStatus: records[0].currentStatus || '',
          idealVision: records[0].idealVision || '',
          keyActions: records[0].keyActions || '',
          blockers: records[0].blockers || '',
          motivation: records[0].motivation || '',
        })
      } else {
        setProgressForm({
          currentStatus: '',
          idealVision: config.idealVision,
          keyActions: '',
          blockers: '',
          motivation: '',
        })
      }

      // Fetch goals for this area
      const goalsRes = await fetch(`/api/goals?area=${config.id}`)
      const goalsData = await goalsRes.json()
      setGoals(goalsData.goals || [])

      // Fetch drift alerts
      const alertsRes = await fetch(`/api/insights?type=alerts`)
      const alertsData = await alertsRes.json()
      const areaAlerts = (alertsData.driftAlerts || []).filter(
        (a: { area: string }) => a.area === config.id
      )
      setDriftAlerts(areaAlerts)

      // Fetch memories
      const memoriesRes = await fetch(`/api/insights?type=memories`)
      const memoriesData = await memoriesRes.json()
      const areaMemories = (memoriesData.memories || []).filter(
        (m: { area: string }) => m.area === config.id
      )
      setMemories(areaMemories)

      // Fetch journal entries
      const journalRes = await fetch(`/api/journal?area=${config.id}`)
      const journalData = await journalRes.json()
      setJournals(journalData.entries || [])

      // Fetch monthly summaries
      const summaryRes = await fetch(`/api/monthly-summary?area=${config.id}`)
      const summaryData = await summaryRes.json()
      setMonthlySummaries(summaryData.summaries || [])
      setCurrentMonthSummary(summaryData.currentMonthSummary || null)
    } catch (err) {
      console.error('Failed to fetch life area data:', err)
    } finally {
      setLoading(false)
    }
  }, [config.id, config.idealVision])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  // ── AI Insight generation ──
  useEffect(() => {
    if (!loading && !aiInsight && !aiInsightLoading) {
      generateInsight()
    }
  }, [loading])

  const generateInsight = async () => {
    setAiInsightLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Give me a brief, personalized insight about my ${config.label} area. Current score: ${currentScore}/10. Focus on one key action I should take this week. Be concise (2-3 sentences max).`,
        }),
      })
      const data = await res.json()
      if (data.response) {
        setAiInsight(data.response)
      }
    } catch {
      setAiInsight('Unable to generate insight right now.')
    } finally {
      setAiInsightLoading(false)
    }
  }

  // ── Save Progress ──
  const saveProgress = async () => {
    setSaving(true)
    try {
      await fetch('/api/life-area', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area: config.id,
          ...progressForm,
        }),
      })
      setShowProgressForm(false)
      fetchAllData()
    } catch (err) {
      console.error('Failed to save progress:', err)
    } finally {
      setSaving(false)
    }
  }

  // ── Update Goal/Task Status ──
  const updateStatus = async (type: 'goal' | 'task', id: string, status: string) => {
    try {
      await fetch('/api/goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, status }),
      })
      // Refresh goals
      const goalsRes = await fetch(`/api/goals?area=${config.id}`)
      const goalsData = await goalsRes.json()
      setGoals(goalsData.goals || [])
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  const cycleTaskStatus = (task: { id: string; status: string }) => {
    const next = task.status === 'Not Started' ? 'In Progress' : task.status === 'In Progress' ? 'Completed' : 'Not Started'
    updateStatus('task', task.id, next)
  }

  // ── Save Journal Entry ──
  const saveJournal = async () => {
    if (!journalForm.content.trim()) return
    setSaving(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area: config.id,
          title: journalForm.title || null,
          content: journalForm.content,
          mood: journalForm.mood || null,
          tags: journalForm.tags || null,
          date: today,
        }),
      })
      setJournalForm({ title: '', content: '', mood: '', tags: '' })
      setShowJournalForm(false)
      // Refresh journals
      const journalRes = await fetch(`/api/journal?area=${config.id}`)
      const journalData = await journalRes.json()
      setJournals(journalData.entries || [])
    } catch (err) {
      console.error('Failed to save journal:', err)
    } finally {
      setSaving(false)
    }
  }

  // ── AI Coach Send Message ──
  const sendCoachMessage = async () => {
    if (!coachInput.trim() || coachLoading) return
    const userMsg = { id: Date.now().toString(), role: 'user' as const, content: coachInput.trim() }
    setCoachMessages((prev) => [...prev, userMsg])
    setCoachInput('')
    setCoachLoading(true)

    try {
      const history = coachMessages.slice(-10).map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: coachInput.trim(),
          history,
        }),
      })
      const data = await res.json()
      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: data.response || 'I am here for you. Let me think about that.',
      }
      setCoachMessages((prev) => [...prev, aiMsg])
    } catch {
      setCoachMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant' as const, content: 'I encountered an error. Please try again.' },
      ])
    } finally {
      setCoachLoading(false)
    }
  }

  // Scroll coach messages
  useEffect(() => {
    if (coachScrollRef.current) {
      coachScrollRef.current.scrollTop = coachScrollRef.current.scrollHeight
    }
  }, [coachMessages])

  // ── Goal stats ──
  const totalTasks = goals.reduce((acc, g) => acc + g.tasks.length, 0)
  const completedTasks = goals.reduce((acc, g) => acc + g.tasks.filter((t) => t.status === 'Completed').length, 0)
  const goalPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // ── Loading State ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className={`h-8 w-8 animate-spin ${TEXT_COLORS[config.color]}`} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ═══ Hero Section ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${config.gradient} border border-neutral-200/60 p-6`}
      >
        {/* Back Button */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className="absolute top-4 left-4 p-2 rounded-full bg-white/70 hover:bg-white shadow-sm transition-all z-10"
        >
          <ArrowLeft className="h-4 w-4 text-neutral-600" />
        </button>

        <div className="flex flex-col sm:flex-row items-center gap-6 pt-4 sm:pt-0">
          {/* Score Circle */}
          <div className="flex flex-col items-center gap-2">
            <ScoreCircle score={currentScore} color={config.color} />
            <span className="text-xs text-neutral-500 font-medium">Current Score</span>
          </div>

          {/* Area Info */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
              <IconComponent className={`h-6 w-6 ${TEXT_COLORS[config.color]}`} />
              <h1 className="text-2xl font-bold text-neutral-800">{config.label}</h1>
            </div>
            <p className="text-sm text-neutral-600 mb-3">{config.description}</p>
            <div className="flex items-center justify-center sm:justify-start gap-3">
              <Badge className={`${BG_COLORS[config.color]} text-white border-0`}>
                {currentScore}/10
              </Badge>
              {scoreTrend.length >= 2 && (
                <span className="text-xs text-neutral-500 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {scoreTrend.length} day trend
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Mini trend chart */}
        {scoreTrend.length > 1 && (
          <div className="mt-4 h-20">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#737373' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: '#737373' }} axisLine={false} tickLine={false} width={20} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e5e5' }}
                  formatter={(value: number) => [`${value}/10`, config.label]}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke={CHART_COLORS[config.color]}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: CHART_COLORS[config.color] }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>

      {/* ═══ Today's Commitment Card ═══ */}
      <TodayCommitmentCard area={config.id} color={config.color} accentColor={config.accentColor} />

      {/* ═══ Tab Navigation ═══ */}
      <Tabs value={activeTabInner} onValueChange={setActiveTabInner}>
        <TabsList className="w-full grid grid-cols-5 h-auto p-1">
          <TabsTrigger value="overview" className="text-xs py-2">
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="goals" className="text-xs py-2">
            <Target className="h-3.5 w-3.5 mr-1.5" />
            Goals
          </TabsTrigger>
          <TabsTrigger value="journal" className="text-xs py-2">
            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
            Journal
          </TabsTrigger>
          <TabsTrigger value="monthly" className="text-xs py-2 relative">
            <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
            Review
            {currentMonthSummary && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </TabsTrigger>
          <TabsTrigger value="coach" className="text-xs py-2">
            <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
            Coach
          </TabsTrigger>
        </TabsList>

        {/* ═══ OVERVIEW TAB ═══ */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* ── Progress Update Section ── */}
          <AnimatePresence mode="wait">
            {!progress && !showProgressForm ? (
              <motion.div
                key="onboarding"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className={`border-2 border-dashed ${LIGHT_BG_COLORS[config.color]} shadow-sm`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className={`h-4 w-4 ${TEXT_COLORS[config.color]}`} />
                      Set Up Your {config.label} Journey
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-neutral-600">
                      Where are you currently in this area of your life? Let&apos;s define your starting point and vision.
                    </p>
                    <Button
                      onClick={() => setShowProgressForm(true)}
                      className={`w-full ${BG_COLORS[config.color]} hover:opacity-90 text-white`}
                    >
                      <PenLine className="mr-2 h-4 w-4" />
                      Define Your {config.label} Vision
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : progress && !showProgressForm ? (
              <motion.div
                key="progress-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <IconComponent className={`h-4 w-4 ${TEXT_COLORS[config.color]}`} />
                        Your {config.label} Progress
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setShowProgressForm(true)} className="text-xs">
                        <PenLine className="mr-1 h-3 w-3" /> Edit
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {progress.currentStatus && (
                        <div>
                          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Current Reality</p>
                          <p className="text-sm text-neutral-700">{progress.currentStatus}</p>
                        </div>
                      )}
                      {progress.idealVision && (
                        <div>
                          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">2026 Vision</p>
                          <p className="text-sm text-neutral-700">{progress.idealVision}</p>
                        </div>
                      )}
                      {progress.keyActions && (
                        <div>
                          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Key Actions</p>
                          {(() => {
                            try {
                              const actions = JSON.parse(progress.keyActions)
                              if (Array.isArray(actions)) {
                                return (
                                  <ul className="space-y-1">
                                    {actions.map((action: string, i: number) => (
                                      <li key={i} className="text-sm text-neutral-700 flex items-start gap-2">
                                        <span className="text-red-500 mt-0.5 shrink-0">•</span>
                                        {action}
                                      </li>
                                    ))}
                                  </ul>
                                )
                              }
                            } catch { /* not JSON */ }
                            return <p className="text-sm text-neutral-700">{progress.keyActions}</p>
                          })()}
                        </div>
                      )}
                      {progress.blockers && (
                        <div>
                          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Blockers</p>
                          <p className="text-sm text-neutral-700">{progress.blockers}</p>
                        </div>
                      )}
                      {progress.motivation && (
                        <div className="sm:col-span-2">
                          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Why This Matters</p>
                          <p className="text-sm text-neutral-700 italic">{progress.motivation}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Progress Form (onboarding or edit) */}
          {showProgressForm && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="shadow-sm border-red-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {progress ? 'Edit' : 'Define'} Your {config.label} Journey
                    </CardTitle>
                    <button onClick={() => setShowProgressForm(false)} className="p-1 hover:bg-neutral-100 rounded">
                      <X className="h-4 w-4 text-neutral-400" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <Label className="text-xs font-medium mt-1.5">Where are you currently in this area of your life?</Label>
                      <VoiceNoteButton
                        value={progressForm.currentStatus}
                        onChange={(val) => setProgressForm({ ...progressForm, currentStatus: val })}
                        label="current status"
                      />
                    </div>
                    <Textarea
                      value={progressForm.currentStatus}
                      onChange={(e) => setProgressForm({ ...progressForm, currentStatus: e.target.value })}
                      placeholder="Describe your current reality..."
                      className="mt-1 text-sm min-h-[60px]"
                    />
                  </div>
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <Label className="text-xs font-medium mt-1.5">What does the ideal look like for you in 2026?</Label>
                      <VoiceNoteButton
                        value={progressForm.idealVision}
                        onChange={(val) => setProgressForm({ ...progressForm, idealVision: val })}
                        label="ideal vision"
                      />
                    </div>
                    <Textarea
                      value={progressForm.idealVision}
                      onChange={(e) => setProgressForm({ ...progressForm, idealVision: e.target.value })}
                      placeholder="Paint the picture of where you want to be..."
                      className="mt-1 text-sm min-h-[60px]"
                    />
                  </div>
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <Label className="text-xs font-medium mt-1.5">What key actions do you need to take?</Label>
                      <VoiceNoteButton
                        value={progressForm.keyActions}
                        onChange={(val) => setProgressForm({ ...progressForm, keyActions: val })}
                        label="key actions"
                      />
                    </div>
                    <Textarea
                      value={progressForm.keyActions}
                      onChange={(e) => setProgressForm({ ...progressForm, keyActions: e.target.value })}
                      placeholder="List the most important actions..."
                      className="mt-1 text-sm min-h-[60px]"
                    />
                  </div>
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <Label className="text-xs font-medium mt-1.5">What&apos;s blocking your progress?</Label>
                      <VoiceNoteButton
                        value={progressForm.blockers}
                        onChange={(val) => setProgressForm({ ...progressForm, blockers: val })}
                        label="blockers"
                      />
                    </div>
                    <Textarea
                      value={progressForm.blockers}
                      onChange={(e) => setProgressForm({ ...progressForm, blockers: e.target.value })}
                      placeholder="What obstacles are in your way?"
                      className="mt-1 text-sm min-h-[60px]"
                    />
                  </div>
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <Label className="text-xs font-medium mt-1.5">Why does this matter to you?</Label>
                      <VoiceNoteButton
                        value={progressForm.motivation}
                        onChange={(val) => setProgressForm({ ...progressForm, motivation: val })}
                        label="motivation"
                      />
                    </div>
                    <Textarea
                      value={progressForm.motivation}
                      onChange={(e) => setProgressForm({ ...progressForm, motivation: e.target.value })}
                      placeholder="Your deeper why..."
                      className="mt-1 text-sm min-h-[60px]"
                    />
                  </div>
                  <Button
                    onClick={saveProgress}
                    disabled={saving}
                    className={`w-full ${BG_COLORS[config.color]} hover:opacity-90 text-white`}
                  >
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {progress ? 'Update Progress' : 'Save & Start Journey'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Current Status vs Ideal ── */}
          {progress && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="shadow-sm border-neutral-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-neutral-500 flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Current Reality
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-neutral-700">{progress.currentStatus || 'Not yet defined'}</p>
                  {progress.blockers && (
                    <div className="mt-3 p-2 bg-rose-50 rounded-lg border border-rose-100">
                      <p className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider mb-1">Blockers</p>
                      <p className="text-xs text-rose-700">{progress.blockers}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className={`shadow-sm ${LIGHT_BG_COLORS[config.color]} border-${config.color}-200`}>
                <CardHeader className="pb-2">
                  <CardTitle className={`text-sm flex items-center gap-2 ${TEXT_COLORS[config.color]}`}>
                    <Sparkles className="h-4 w-4" />
                    2026 Vision
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-neutral-700">{progress.idealVision || config.idealVision}</p>
                  {progress.motivation && (
                    <div className="mt-3 p-2 bg-white/60 rounded-lg border border-white">
                      <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${TEXT_COLORS[config.color]}`}>Why This Matters</p>
                      <p className="text-xs text-neutral-600 italic">{progress.motivation}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Analytics & Patterns ── */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className={`h-4 w-4 ${TEXT_COLORS[config.color]}`} />
                Analytics & Patterns
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Score Trend Chart */}
              {scoreTrend.length > 1 ? (
                <div className="h-48">
                  <p className="text-xs font-medium text-neutral-500 mb-2">Score Trend (Last 14 Days)</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={scoreTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#737373' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: '#737373' }} axisLine={false} tickLine={false} width={25} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e5e5' }}
                        formatter={(value: number) => [`${value}/10`, config.label]}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke={CHART_COLORS[config.color]}
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: CHART_COLORS[config.color] }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-neutral-400 text-center py-6">Start checking in to see score trends over time.</p>
              )}

              {/* Drift Alerts */}
              {driftAlerts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Recent Drift Alerts</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {driftAlerts.slice(0, 5).map((alert) => (
                      <div key={alert.id} className="flex items-start gap-2 p-2 bg-rose-50 rounded-lg border border-rose-100">
                        <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-rose-700">{alert.message}</p>
                          <p className="text-[10px] text-rose-400 mt-0.5">{alert.severity} &bull; {alert.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Memories */}
              {memories.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Recent Patterns & Memories</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {memories.slice(0, 5).map((memory) => (
                      <div key={memory.id} className="flex items-start gap-2 p-2 bg-neutral-50 rounded-lg">
                        <Lightbulb className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-neutral-700">{memory.content}</p>
                          <p className="text-[10px] text-neutral-400 mt-0.5">{memory.type} &bull; {memory.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Generated Insight */}
              <div className="p-4 bg-gradient-to-br from-neutral-50 to-red-50/30 rounded-xl border border-neutral-200/60">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className={`h-4 w-4 ${TEXT_COLORS[config.color]}`} />
                  <span className="text-xs font-semibold text-neutral-600">AI Insight</span>
                </div>
                {aiInsightLoading ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className={`h-4 w-4 animate-spin ${TEXT_COLORS[config.color]}`} />
                    <span className="text-xs text-neutral-400">Generating insight...</span>
                  </div>
                ) : aiInsight ? (
                  <div className="prose prose-sm max-w-none prose-neutral prose-p:text-neutral-700 text-sm">
                    <ReactMarkdown>{aiInsight}</ReactMarkdown>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ GOALS TAB ═══ */}
        <TabsContent value="goals" className="space-y-6 mt-4">
          {/* Goals Summary */}
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-neutral-500">Goals Progress</span>
                <span className="text-xs text-neutral-400">{completedTasks}/{totalTasks} tasks</span>
              </div>
              <Progress value={goalPercent} className="h-2.5" />
              <div className="flex items-center gap-4 mt-2">
                <span className="text-[10px] text-red-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {completedTasks} completed
                </span>
                <span className="text-[10px] text-rose-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {goals.reduce((a, g) => a + g.tasks.filter((t) => t.status === 'In Progress').length, 0)} in progress
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Goals List */}
          {goals.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="p-6 text-center">
                <Target className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                <p className="text-sm text-neutral-500">No goals in this area yet.</p>
                <p className="text-xs text-neutral-400">Goals added to this area will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => {
                const gCompleted = goal.tasks.filter((t) => t.status === 'Completed').length
                const gPercent = goal.tasks.length > 0 ? Math.round((gCompleted / goal.tasks.length) * 100) : 0

                return (
                  <Card key={goal.id} className="shadow-sm">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <button
                            onClick={() => {
                              const next = goal.status === 'Not Started' ? 'In Progress' : goal.status === 'In Progress' ? 'Completed' : 'Not Started'
                              updateStatus('goal', goal.id, next)
                            }}
                            className="mt-0.5 shrink-0"
                          >
                            {goal.status === 'Completed' ? (
                              <CheckCircle2 className="h-5 w-5 text-red-600" />
                            ) : goal.status === 'In Progress' ? (
                              <Clock className="h-5 w-5 text-rose-500" />
                            ) : (
                              <Circle className="h-5 w-5 text-neutral-300" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-neutral-800">{goal.title}</p>
                            {goal.description && <p className="text-xs text-neutral-500 mt-0.5">{goal.description}</p>}
                          </div>
                        </div>
                        <Badge
                          variant={goal.status === 'Completed' ? 'default' : goal.status === 'In Progress' ? 'secondary' : 'outline'}
                          className="text-[10px] shrink-0"
                        >
                          {goal.status}
                        </Badge>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-neutral-400">{gCompleted}/{goal.tasks.length} tasks</span>
                          <span className="text-[10px] text-neutral-400">{gPercent}%</span>
                        </div>
                        <Progress value={gPercent} className="h-1.5" />
                      </div>
                    </CardHeader>
                    {goal.tasks.length > 0 && (
                      <CardContent className="pt-0">
                        <div className="space-y-1 pl-7">
                          {goal.tasks.map((task) => (
                            <div
                              key={task.id}
                              className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-neutral-50 group"
                            >
                              <button
                                onClick={() => cycleTaskStatus(task)}
                                className="mt-0.5 shrink-0"
                              >
                                {task.status === 'Completed' ? (
                                  <CheckCircle2 className="h-4 w-4 text-red-600" />
                                ) : task.status === 'In Progress' ? (
                                  <Clock className="h-4 w-4 text-rose-500" />
                                ) : (
                                  <Circle className="h-4 w-4 text-neutral-300" />
                                )}
                              </button>
                              <p className={`text-xs flex-1 ${task.status === 'Completed' ? 'line-through text-neutral-400' : 'text-neutral-700'}`}>
                                {task.title}
                              </p>
                              {task.difficulty && (
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${
                                    task.difficulty === 'High'
                                      ? 'bg-rose-100 text-rose-600'
                                      : task.difficulty === 'Medium'
                                        ? 'bg-red-100 text-red-600'
                                        : 'bg-neutral-100 text-neutral-600'
                                  }`}
                                >
                                  {task.difficulty}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ═══ JOURNAL TAB ═══ */}
        <TabsContent value="journal" className="space-y-6 mt-4">
          {/* Write New Entry Button */}
          {!showJournalForm ? (
            <Button
              onClick={() => setShowJournalForm(true)}
              className={`w-full ${BG_COLORS[config.color]} hover:opacity-90 text-white`}
            >
              <PenLine className="mr-2 h-4 w-4" />
              Write New Entry
            </Button>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="shadow-sm border-red-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">New Journal Entry</CardTitle>
                    <button onClick={() => setShowJournalForm(false)} className="p-1 hover:bg-neutral-100 rounded">
                      <X className="h-4 w-4 text-neutral-400" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs font-medium">Title (optional)</Label>
                    <Input
                      value={journalForm.title}
                      onChange={(e) => setJournalForm({ ...journalForm, title: e.target.value })}
                      placeholder="Give this entry a title..."
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">What&apos;s on your mind?</Label>
                    <Textarea
                      value={journalForm.content}
                      onChange={(e) => setJournalForm({ ...journalForm, content: e.target.value })}
                      placeholder="Write your thoughts..."
                      className="mt-1 text-sm min-h-[120px]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">How are you feeling?</Label>
                    <div className="mt-1">
                      <MoodSelector value={journalForm.mood} onChange={(v) => setJournalForm({ ...journalForm, mood: v })} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Tags (comma-separated)</Label>
                    <Input
                      value={journalForm.tags}
                      onChange={(e) => setJournalForm({ ...journalForm, tags: e.target.value })}
                      placeholder="e.g., reflection, breakthrough, prayer"
                      className="mt-1 text-sm"
                    />
                  </div>
                  <Button
                    onClick={saveJournal}
                    disabled={saving || !journalForm.content.trim()}
                    className={`w-full ${BG_COLORS[config.color]} hover:opacity-90 text-white`}
                  >
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Entry
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Journal Timeline */}
          {journals.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="p-6 text-center">
                <BookOpen className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                <p className="text-sm text-neutral-500">No journal entries yet.</p>
                <p className="text-xs text-neutral-400">Start writing to track your {config.label.toLowerCase()} journey.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-0">
              {journals.map((entry, i) => {
                const moodLabel = MOODS.find((m) => m.value === entry.mood)?.label
                return (
                  <div key={entry.id} className="relative pl-8 pb-6">
                    {/* Timeline line */}
                    {i < journals.length - 1 && (
                      <div className="absolute left-3 top-6 bottom-0 w-px bg-neutral-200" />
                    )}
                    {/* Timeline dot */}
                    <div className={`absolute left-1.5 top-1.5 w-3 h-3 rounded-full ${BG_COLORS[config.color]} border-2 border-white shadow-sm`} />

                    <Card className="shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="text-sm font-medium text-neutral-800">
                              {entry.title || 'Untitled Entry'}
                            </h4>
                            <p className="text-[10px] text-neutral-400">{entry.date}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {moodLabel && <span className="text-[10px] text-neutral-500">{moodLabel}</span>}
                            {entry.tags && (
                              <Badge variant="secondary" className="text-[9px]">{entry.tags}</Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-neutral-600 whitespace-pre-wrap line-clamp-3">{entry.content}</p>
                      </CardContent>
                    </Card>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ═══ MONTHLY REVIEW TAB ═══ */}
        <TabsContent value="monthly" className="space-y-6 mt-4">
          {/* Generate Summary Section */}
          <Card className={`shadow-sm border-2 border-dashed ${currentMonthSummary ? 'border-neutral-200' : `${LIGHT_BG_COLORS[config.color]} border-red-200`}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className={`h-4 w-4 ${TEXT_COLORS[config.color]}`} />
                  Monthly Review — {(() => {
                    const now = new Date()
                    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                  })()}
                </CardTitle>
                {currentMonthSummary && (
                  <Badge className={`${BG_COLORS[config.color]} text-white border-0`}>
                    {currentMonthSummary.score}/10
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentMonthSummary ? (
                <>
                  <p className="text-xs text-neutral-500">
                    Your {config.label} monthly review from MyOS AI Coach is ready.
                  </p>
                  <div className="coach-response p-4 bg-white rounded-xl border border-neutral-200/60">
                    <ReactMarkdown>{currentMonthSummary.summary}</ReactMarkdown>
                  </div>
                  <Button
                    onClick={async () => {
                      setSummaryGenerating(true)
                      try {
                        const now = new Date()
                        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                        const res = await fetch('/api/monthly-summary', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ area: config.id, month }),
                        })
                        const data = await res.json()
                        if (data.summary) {
                          setCurrentMonthSummary(data.summary)
                          // Also refresh the list
                          const summaryRes = await fetch(`/api/monthly-summary?area=${config.id}`)
                          const summaryData = await summaryRes.json()
                          setMonthlySummaries(summaryData.summaries || [])
                        }
                      } catch (err) {
                        console.error('Failed to regenerate summary:', err)
                      } finally {
                        setSummaryGenerating(false)
                      }
                    }}
                    disabled={summaryGenerating}
                    variant="outline"
                    className={`w-full border-red-200 ${TEXT_COLORS[config.color]} hover:bg-red-50`}
                  >
                    {summaryGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Regenerate This Month&apos;s Review
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-center py-6">
                    <div className={`w-16 h-16 rounded-2xl ${LIGHT_BG_COLORS[config.color]} flex items-center justify-center mx-auto mb-4`}>
                      <FileText className={`h-8 w-8 ${TEXT_COLORS[config.color]}`} />
                    </div>
                    <h3 className="text-lg font-semibold text-neutral-700 mb-2">
                      No Monthly Review Yet
                    </h3>
                    <p className="text-sm text-neutral-500 max-w-sm mx-auto mb-4">
                      Generate your {config.label} monthly review. The AI Coach will analyze your check-ins, scores, goals, and patterns to give you a comprehensive briefing.
                    </p>
                  </div>
                  <Button
                    onClick={async () => {
                      setSummaryGenerating(true)
                      try {
                        const now = new Date()
                        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                        const res = await fetch('/api/monthly-summary', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ area: config.id, month }),
                        })
                        const data = await res.json()
                        if (data.summary) {
                          setCurrentMonthSummary(data.summary)
                          // Also refresh the list
                          const summaryRes = await fetch(`/api/monthly-summary?area=${config.id}`)
                          const summaryData = await summaryRes.json()
                          setMonthlySummaries(summaryData.summaries || [])
                        }
                      } catch (err) {
                        console.error('Failed to generate summary:', err)
                      } finally {
                        setSummaryGenerating(false)
                      }
                    }}
                    disabled={summaryGenerating}
                    className={`w-full ${BG_COLORS[config.color]} hover:opacity-90 text-white`}
                  >
                    {summaryGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Generate Monthly Review
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Past Monthly Summaries */}
          {monthlySummaries.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className={`h-4 w-4 ${TEXT_COLORS[config.color]}`} />
                  Past Monthly Reviews
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {monthlySummaries
                    .filter(s => s.id !== currentMonthSummary?.id)
                    .map((summary) => (
                    <div key={summary.id} className="border border-neutral-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedSummary(expandedSummary === summary.id ? null : summary.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${LIGHT_BG_COLORS[config.color]} flex items-center justify-center`}>
                            <CalendarDays className={`h-5 w-5 ${TEXT_COLORS[config.color]}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-neutral-800">{summary.month}</p>
                            <p className="text-[10px] text-neutral-400">
                              {new Date(summary.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {summary.score !== null && (
                            <Badge variant="outline" className="text-xs border-neutral-300">
                              {summary.score}/10
                            </Badge>
                          )}
                          {expandedSummary === summary.id ? (
                            <ChevronUp className="h-4 w-4 text-neutral-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-neutral-400" />
                          )}
                        </div>
                      </button>
                      {expandedSummary === summary.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          className="border-t border-neutral-200"
                        >
                          <div className="coach-response p-4 bg-neutral-50/50">
                            <ReactMarkdown>{summary.summary}</ReactMarkdown>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Monthly Summary Feature Explanation */}
          {monthlySummaries.length === 0 && !currentMonthSummary && (
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div className={`w-20 h-20 rounded-full ${LIGHT_BG_COLORS[config.color]} flex items-center justify-center mx-auto`}>
                    <Sparkles className={`h-10 w-10 ${TEXT_COLORS[config.color]}`} />
                  </div>
                  <h3 className="text-lg font-bold text-neutral-800">How Monthly Reviews Work</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-lg mx-auto">
                    <div className="p-3 bg-neutral-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-red-500" />
                        <span className="text-xs font-semibold text-neutral-700">Analyze</span>
                      </div>
                      <p className="text-[10px] text-neutral-500">Reviews your check-ins, scores, goals, and patterns for the month</p>
                    </div>
                    <div className="p-3 bg-neutral-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="h-4 w-4 text-red-500" />
                        <span className="text-xs font-semibold text-neutral-700">Assess</span>
                      </div>
                      <p className="text-[10px] text-neutral-500">Gives an honest score and highlights wins, concerns, and drift</p>
                    </div>
                    <div className="p-3 bg-neutral-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Lightbulb className="h-4 w-4 text-red-500" />
                        <span className="text-xs font-semibold text-neutral-700">Recommend</span>
                      </div>
                      <p className="text-[10px] text-neutral-500">Provides specific, actionable recommendations for next month</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ AI COACH TAB ═══ */}
        <TabsContent value="coach" className="mt-4">
          <div className="flex flex-col h-[calc(100vh-16rem)] md:h-[calc(100vh-10rem)]">
            {/* Coach Header */}
            <div className={`flex items-center gap-3 px-4 py-3 ${LIGHT_BG_COLORS[config.color]} rounded-xl mb-3`}>
              <div className={`w-10 h-10 rounded-full ${BG_COLORS[config.color]} flex items-center justify-center`}>
                <IconComponent className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-800">{config.label} Coach</h3>
                <p className="text-[10px] text-neutral-500">{config.promptPrefix.split('.').slice(0, 1).join('.')}</p>
              </div>
            </div>

            {/* Messages */}
            <div ref={coachScrollRef} className="flex-1 overflow-y-auto space-y-3 px-1 pb-3">
              {coachMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <div className={`w-16 h-16 rounded-2xl ${LIGHT_BG_COLORS[config.color]} flex items-center justify-center mb-4`}>
                    <IconComponent className={`h-8 w-8 ${TEXT_COLORS[config.color]}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-700 mb-2">
                    {config.label} Coach
                  </h3>
                  <p className="text-sm text-neutral-500 max-w-sm">
                    Ask me anything about your {config.label.toLowerCase()} journey. I&apos;m here to guide, challenge, and support you.
                  </p>
                  <div className="grid grid-cols-1 gap-2 w-full max-w-sm mt-4">
                    {[
                      `What should I focus on in ${config.label}?`,
                      `Help me overcome a blocker in ${config.label}`,
                      `What patterns do you see in my ${config.label}?`,
                    ].map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setCoachInput(prompt)
                        }}
                        className={`text-left text-xs p-3 rounded-xl bg-white border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition-all`}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {coachMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 ${
                          msg.role === 'user'
                            ? `${BG_COLORS[config.color]} text-white rounded-br-md`
                            : 'bg-white border border-neutral-200 text-neutral-800 rounded-bl-md shadow-sm'
                        }`}
                      >
                        {msg.role === 'assistant' ? (
                          <div className="prose prose-sm max-w-none prose-neutral prose-headings:text-neutral-800 prose-strong:text-neutral-700 prose-p:text-neutral-700 text-sm">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {coachLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-neutral-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2">
                          <Loader2 className={`h-4 w-4 animate-spin ${TEXT_COLORS[config.color]}`} />
                          <span className="text-xs text-neutral-500">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Input */}
            <div className="border-t bg-white/80 backdrop-blur-sm p-3 rounded-b-xl">
              <div className="flex items-end gap-2">
                <Textarea
                  value={coachInput}
                  onChange={(e) => setCoachInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendCoachMessage()
                    }
                  }}
                  placeholder={`Ask your ${config.label} Coach...`}
                  className="text-sm min-h-[44px] max-h-[120px] resize-none"
                  rows={1}
                />
                <Button
                  onClick={sendCoachMessage}
                  disabled={coachLoading || !coachInput.trim()}
                  size="icon"
                  className={`${BG_COLORS[config.color]} hover:opacity-90 text-white shrink-0`}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
