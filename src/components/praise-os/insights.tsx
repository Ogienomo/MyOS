'use client'

import { useState, useEffect, useCallback } from 'react'
import { InsightsSkeleton } from './loading-skeleton'
import { useAppStore, DriftAlert, Memory } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Sparkles,
  Brain,
  Shield,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  CalendarHeart,
  RefreshCw,
  Zap,
  Heart,
  Target,
  CalendarDays,
  FileText,
  Star,
  GitBranch,
} from 'lucide-react'
import { AREA_CONFIG, getAreaConfig } from '@/lib/area-config'

const areaConfig = AREA_CONFIG

const memoryTypeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  win: { label: 'Win', icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-red-600 bg-red-100' },
  strength: { label: 'Strength', icon: <TrendingUp className="h-4 w-4" />, color: 'text-red-600 bg-red-100' },
  weakness: { label: 'Weakness', icon: <AlertTriangle className="h-4 w-4" />, color: 'text-rose-600 bg-rose-100' },
  distraction: { label: 'Distraction', icon: <Sparkles className="h-4 w-4" />, color: 'text-red-600 bg-red-100' },
  correction: { label: 'Correction', icon: <Shield className="h-4 w-4" />, color: 'text-red-600 bg-red-100' },
  decision: { label: 'Decision', icon: <Brain className="h-4 w-4" />, color: 'text-red-700 bg-red-100' },
  pattern: { label: 'Pattern', icon: <Lightbulb className="h-4 w-4" />, color: 'text-rose-600 bg-rose-100' },
  event: { label: 'Event', icon: <CalendarHeart className="h-4 w-4" />, color: 'text-rose-600 bg-rose-100' },
}

// Types for new API responses
interface WeeklyInsight {
  insight: string
  dataPoints: number
  weekKey: string
  generatedAt: string
  cached: boolean
}

interface FinanceSummary {
  totalReceived: number
  totalSpent: number
  netFlow: number
  topSpendingCategories: Array<{ category: string; amount: number }>
  autoDetectedEntries: Array<{
    id: string
    date: string
    type: string
    amount: number
    category: string
    purpose: string | null
  }>
  totalEntries: number
  autoDetectedCount: number
}

interface MoodPatterns {
  hasData: boolean
  message?: string
  period?: string
  totalLogs?: number
  averages?: { mood: number; energy: number; focus: number }
  moodTrend?: string
  energyPattern?: {
    highestDay: { day: string; avgEnergy: number } | null
    lowestDay: { day: string; avgEnergy: number } | null
  }
  focusMoodCorrelation?: string
  bestDay?: { date: string; mood: number; energy: number; focus: number }
  worstDay?: { date: string; mood: number; energy: number; focus: number }
}

interface LifeAreaProgressItem {
  area: string
  currentStatus: string | null
  idealVision: string | null
  keyActions: string | null
  blockers: string | null
  motivation: string | null
}

interface MonthlySummaryItem {
  id: string
  area: string
  month: string
  summary: string
  highlights: string | null
  score: number | null
  createdAt: string
  updatedAt: string
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `₦${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000) return `₦${(amount / 1000).toFixed(1)}K`
  return `₦${amount.toFixed(0)}`
}

// ─── Correlations Section Component ────────────────────────────────
function CorrelationsSection() {
  const [correlations, setCorrelations] = useState<{ area1: string; area2: string; coefficient: number; direction: string; insight: string }[]>([])
  const [insights, setInsights] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCorrelations = async () => {
      try {
        const res = await fetch('/api/correlations')
        if (res.ok) {
          const data = await res.json()
          setCorrelations(data.correlations || [])
          setInsights(data.insights || [])
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }
    fetchCorrelations()
  }, [])

  const areas = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth']
  const areaLabels: Record<string, string> = {
    faith: 'Faith', health: 'Health', career: 'Career', havilah: 'Business',
    finances: 'Finances', relationships: 'Relationships', personalGrowth: 'Growth',
  }

  // Build correlation lookup
  const corrMap: Record<string, number> = {}
  for (const c of correlations) {
    corrMap[`${c.area1}-${c.area2}`] = c.coefficient
    corrMap[`${c.area2}-${c.area1}`] = c.coefficient
  }

  function getCoefficient(a1: string, a2: string): number {
    return corrMap[`${a1}-${a2}`] ?? 0
  }

  function getCorrelationColor(coeff: number): string {
    if (coeff >= 0.7) return 'bg-red-600 text-white'
    if (coeff >= 0.5) return 'bg-red-400 text-red-950'
    if (coeff >= 0.4) return 'bg-red-100 text-red-700'
    if (coeff <= -0.7) return 'bg-rose-500 text-white'
    if (coeff <= -0.5) return 'bg-rose-300 text-rose-900'
    if (coeff <= -0.4) return 'bg-rose-100 text-rose-700'
    return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-700">
              <GitBranch className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm">Life Area Interconnections</CardTitle>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">How your life areas influence each other</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {correlations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Not enough data yet. Keep logging scores to reveal connections between your life areas.</p>
            </div>
          ) : (
            <>
              {/* Correlation Matrix */}
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr>
                      <th className="p-1 text-left font-medium text-neutral-500 dark:text-neutral-400"></th>
                      {areas.map(a => (
                        <th key={a} className="p-1 text-center font-medium text-neutral-500 dark:text-neutral-400 whitespace-nowrap">{areaLabels[a].slice(0, 3)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {areas.map(a1 => (
                      <tr key={a1}>
                        <td className="p-1 font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap">{areaLabels[a1].slice(0, 3)}</td>
                        {areas.map(a2 => {
                          if (a1 === a2) {
                            return <td key={a2} className="p-0.5"><div className="w-full h-6 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-neutral-400">—</div></td>
                          }
                          const coeff = getCoefficient(a1, a2)
                          return (
                            <td key={a2} className="p-0.5">
                              <div className={`w-full h-6 rounded flex items-center justify-center text-[9px] font-medium ${getCorrelationColor(coeff)}`}>
                                {Math.abs(coeff) >= 0.4 ? coeff.toFixed(1) : ''}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3 mt-3 text-[10px] text-neutral-500 dark:text-neutral-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400"></span> Positive</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-300"></span> Negative</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-neutral-100 dark:bg-neutral-800"></span> Weak/None</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Top Insights */}
      {insights.length > 0 && (
        <Card className="shadow-sm border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-red-500" />
              <CardTitle className="text-sm">Key Insights</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {insights.map((insight, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 flex items-center justify-center shrink-0 text-[10px] font-bold">
                    {i + 1}
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

export function Insights() {
  const { driftAlerts, memories, insightsLoading, setDriftAlerts, setMemories, setInsightsLoading, highlightItemId, highlightItemType, clearHighlightItem } = useAppStore()
  const { toast } = useToast()

  // ─── Highlight item from search navigation ─────────────────────────────
  useEffect(() => {
    if (!highlightItemId || (highlightItemType !== 'memories' && highlightItemType !== 'alerts')) return

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

  // New state for enhanced data
  const [weeklyInsight, setWeeklyInsight] = useState<WeeklyInsight | null>(null)
  const [weeklyInsightLoading, setWeeklyInsightLoading] = useState(false)
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null)
  const [financeSummaryLoading, setFinanceSummaryLoading] = useState(false)
  const [moodPatterns, setMoodPatterns] = useState<MoodPatterns | null>(null)
  const [moodPatternsLoading, setMoodPatternsLoading] = useState(false)
  const [lifeAreaProgress, setLifeAreaProgress] = useState<LifeAreaProgressItem[]>([])
  const [lifeAreaProgressLoading, setLifeAreaProgressLoading] = useState(false)
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummaryItem[]>([])
  const [monthlySummariesLoading, setMonthlySummariesLoading] = useState(false)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [selectedSummaryMonth, setSelectedSummaryMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const fetchBaseData = useCallback(async () => {
    try {
      const [alertsRes, memoriesRes] = await Promise.all([
        fetch('/api/insights?type=alerts&resolved=false'),
        fetch('/api/insights?type=memories'),
      ])
      const alertsData = await alertsRes.json()
      const memoriesData = await memoriesRes.json()
      setDriftAlerts(alertsData.alerts || [])
      setMemories(memoriesData.memories || [])
    } catch (err) {
      console.error('Failed to fetch insights:', err)
    } finally {
      setInsightsLoading(false)
    }
  }, [setDriftAlerts, setMemories, setInsightsLoading])

  const fetchWeeklyInsight = useCallback(async () => {
    setWeeklyInsightLoading(true)
    try {
      const res = await fetch('/api/insights/weekly')
      if (res.ok) {
        const data = await res.json()
        setWeeklyInsight(data)
      }
    } catch (err) {
      console.error('Failed to fetch weekly insight:', err)
    } finally {
      setWeeklyInsightLoading(false)
    }
  }, [])

  const fetchFinanceSummary = useCallback(async () => {
    setFinanceSummaryLoading(true)
    try {
      const res = await fetch('/api/insights/finance-summary')
      if (res.ok) {
        const data = await res.json()
        setFinanceSummary(data)
      }
    } catch (err) {
      console.error('Failed to fetch finance summary:', err)
    } finally {
      setFinanceSummaryLoading(false)
    }
  }, [])

  const fetchMoodPatterns = useCallback(async () => {
    setMoodPatternsLoading(true)
    try {
      const res = await fetch('/api/insights/mood-patterns')
      if (res.ok) {
        const data = await res.json()
        setMoodPatterns(data)
      }
    } catch (err) {
      console.error('Failed to fetch mood patterns:', err)
    } finally {
      setMoodPatternsLoading(false)
    }
  }, [])

  const fetchLifeAreaProgress = useCallback(async () => {
    setLifeAreaProgressLoading(true)
    try {
      const res = await fetch('/api/life-area')
      if (res.ok) {
        const data = await res.json()
        setLifeAreaProgress(data.records || [])
      }
    } catch (err) {
      console.error('Failed to fetch life area progress:', err)
    } finally {
      setLifeAreaProgressLoading(false)
    }
  }, [])

  const fetchMonthlySummaries = useCallback(async (month?: string) => {
    setMonthlySummariesLoading(true)
    try {
      const targetMonth = month || selectedSummaryMonth
      const res = await fetch(`/api/monthly-summary?month=${targetMonth}`)
      if (res.ok) {
        const data = await res.json()
        setMonthlySummaries(data.summaries || [])
      }
    } catch (err) {
      console.error('Failed to fetch monthly summaries:', err)
    } finally {
      setMonthlySummariesLoading(false)
    }
  }, [selectedSummaryMonth])

  const handleGenerateSummary = useCallback(async () => {
    setGeneratingSummary(true)
    try {
      const res = await fetch('/api/monthly-summary/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedSummaryMonth }),
      })
      if (res.ok) {
        const data = await res.json()
        // Refresh summaries after generation
        await fetchMonthlySummaries(selectedSummaryMonth)
        toast({ title: 'Memory saved', description: 'Monthly summary has been generated.' })
        return data
      }
    } catch (err) {
      console.error('Failed to generate monthly summary:', err)
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' })
    } finally {
      setGeneratingSummary(false)
    }
  }, [selectedSummaryMonth, fetchMonthlySummaries])

  useEffect(() => {
    fetchBaseData()
    fetchWeeklyInsight()
    fetchFinanceSummary()
    fetchMoodPatterns()
    fetchLifeAreaProgress()
    fetchMonthlySummaries()
  }, [fetchBaseData, fetchWeeklyInsight, fetchFinanceSummary, fetchMoodPatterns, fetchLifeAreaProgress, fetchMonthlySummaries])

  if (insightsLoading) {
    return <InsightsSkeleton />
  }

  const groupedMemories: Record<string, Memory[]> = {}
  memories.forEach(m => {
    if (!groupedMemories[m.type]) groupedMemories[m.type] = []
    groupedMemories[m.type].push(m)
  })

  // Calculate life area scores from recent scores for progress bars
  const lifeAreas = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-slow-fade-in">
        <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100">Insights &amp; Patterns</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">AI-powered analysis, drift detection, and patterns that improve decisions.</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex w-full overflow-x-auto gap-1.5 pb-1 md:grid md:grid-cols-6 md:overflow-visible md:pb-0 scrollbar-hide">
          <TabsTrigger value="overview" className="text-xs flex-none whitespace-nowrap px-3 py-2 duration-300 data-[state=active]:text-red-600 dark:data-[state=active]:text-red-400">
            <Sparkles className="mr-1 h-3 w-3" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="drift" className="text-xs flex-none whitespace-nowrap px-3 py-2 duration-300 data-[state=active]:text-red-600 dark:data-[state=active]:text-red-400">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Drift ({driftAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="patterns" className="text-xs flex-none whitespace-nowrap px-3 py-2 duration-300 data-[state=active]:text-red-600 dark:data-[state=active]:text-red-400">
            <Lightbulb className="mr-1 h-3 w-3" />
            Memory ({memories.length})
          </TabsTrigger>
          <TabsTrigger value="correlations" className="text-xs flex-none whitespace-nowrap px-3 py-2 duration-300 data-[state=active]:text-red-600 dark:data-[state=active]:text-red-400">
            <GitBranch className="mr-1 h-3 w-3" />
            Links
          </TabsTrigger>
          <TabsTrigger value="monthly" className="text-xs flex-none whitespace-nowrap px-3 py-2 duration-300 data-[state=active]:text-red-600 dark:data-[state=active]:text-red-400">
            <CalendarDays className="mr-1 h-3 w-3" />
            Monthly
          </TabsTrigger>
          <TabsTrigger value="financial" className="text-xs flex-none whitespace-nowrap px-3 py-2 duration-300 data-[state=active]:text-red-600 dark:data-[state=active]:text-red-400">
            <DollarSign className="mr-1 h-3 w-3" />
            Financial
          </TabsTrigger>
        </TabsList>

        {/* =============== OVERVIEW TAB =============== */}
        <TabsContent value="overview" className="mt-4 space-y-4 animate-slow-fade-up">

          {/* A. AI-Powered Weekly Insight */}
          <Card className="shadow-sm border-l-4 border-l-rose-500">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-rose-100 text-rose-600">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">AI Weekly Insight</CardTitle>
                    <p className="text-[10px] text-neutral-400">
                      {weeklyInsight?.cached ? 'Cached' : 'Generated'} &bull; {weeklyInsight?.dataPoints || 0} data points
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => fetchWeeklyInsight()}
                  disabled={weeklyInsightLoading}
                >
                  {weeklyInsightLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {weeklyInsightLoading && !weeklyInsight ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-rose-500" />
                  <span className="text-xs text-neutral-500">Generating insight...</span>
                </div>
              ) : weeklyInsight ? (
                <p className="text-sm text-neutral-700 leading-relaxed">{weeklyInsight.insight}</p>
              ) : (
                <p className="text-xs text-neutral-400 py-2">No insight available yet. Start chatting and checking in!</p>
              )}
            </CardContent>
          </Card>

          {/* B. Financial Auto-Tracking Summary (compact) */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-100 text-red-600">
                  <DollarSign className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm">This Week&apos;s Finances</CardTitle>
                  <p className="text-[10px] text-neutral-400">
                    {financeSummary?.autoDetectedCount || 0} auto-detected
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {financeSummaryLoading ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                  <span className="text-xs text-neutral-500">Loading...</span>
                </div>
              ) : financeSummary ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 rounded-lg bg-red-50">
                      <ArrowUpRight className="h-3 w-3 text-red-600 mx-auto mb-1" />
                      <p className="text-xs font-semibold text-red-700">{formatCurrency(financeSummary.totalReceived)}</p>
                      <p className="text-[10px] text-red-600 mt-0.5">Received</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-neutral-50">
                      <ArrowDownRight className="h-3 w-3 text-neutral-500 mx-auto mb-1" />
                      <p className="text-xs font-medium text-neutral-800">{formatCurrency(financeSummary.totalSpent)}</p>
                      <p className="text-[10px] text-neutral-500 mt-0.5">Spent</p>
                    </div>
                    <div className={`text-center p-2 rounded-lg ${financeSummary.netFlow >= 0 ? 'bg-red-50' : 'bg-rose-50'}`}>
                      <Activity className={`h-3 w-3 mx-auto mb-1 ${financeSummary.netFlow >= 0 ? 'text-red-600' : 'text-rose-600'}`} />
                      <p className={`text-xs font-semibold ${financeSummary.netFlow >= 0 ? 'text-red-700' : 'text-rose-700'}`}>
                        {formatCurrency(financeSummary.netFlow)}
                      </p>
                      <p className={`text-[10px] mt-0.5 ${financeSummary.netFlow >= 0 ? 'text-red-600' : 'text-rose-600'}`}>Net</p>
                    </div>
                  </div>
                  {financeSummary.topSpendingCategories.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-neutral-500 mb-1.5">Top Spending</p>
                      <div className="space-y-1.5">
                        {financeSummary.topSpendingCategories.slice(0, 3).map((cat) => (
                          <div key={cat.category} className="flex items-center justify-between">
                            <span className="text-xs text-neutral-600">{cat.category}</span>
                            <span className="text-xs font-medium text-neutral-700">{formatCurrency(cat.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-neutral-400 py-2">No financial data this week.</p>
              )}
            </CardContent>
          </Card>

          {/* C. Mood Pattern Insights */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-100 text-red-700">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm">Mood Patterns</CardTitle>
                  <p className="text-[10px] text-neutral-400">Past 2 weeks &bull; {moodPatterns?.totalLogs || 0} logs</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {moodPatternsLoading ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                  <span className="text-xs text-neutral-500">Analyzing...</span>
                </div>
              ) : moodPatterns?.hasData && moodPatterns.averages ? (
                <div className="space-y-3">
                  {/* Mood Trend */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50">
                    <span className="text-xs text-neutral-600">Mood Trend</span>
                    <div className="flex items-center gap-1">
                      {moodPatterns.moodTrend === 'improving' && (
                        <><TrendingUp className="h-3.5 w-3.5 text-red-600" /><Badge className="text-[10px] bg-red-100 text-red-700 hover:bg-red-100">Improving</Badge></>
                      )}
                      {moodPatterns.moodTrend === 'declining' && (
                        <><TrendingDown className="h-3.5 w-3.5 text-red-800" /><Badge className="text-[10px] bg-red-100 text-red-800 hover:bg-red-100">Declining</Badge></>
                      )}
                      {moodPatterns.moodTrend === 'stable' && (
                        <><Minus className="h-3.5 w-3.5 text-neutral-500" /><Badge variant="secondary" className="text-[10px]">Stable</Badge></>
                      )}
                    </div>
                  </div>

                  {/* Averages */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 rounded-lg bg-rose-50">
                      <Heart className="h-3 w-3 text-rose-500 mx-auto mb-1" />
                      <p className="text-sm font-bold text-rose-700">{moodPatterns.averages.mood}</p>
                      <p className="text-[10px] text-rose-600 mt-0.5">Avg Mood</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-rose-50">
                      <Zap className="h-3 w-3 text-rose-500 mx-auto mb-1" />
                      <p className="text-sm font-bold text-rose-700">{moodPatterns.averages.energy}</p>
                      <p className="text-[10px] text-rose-600 mt-0.5">Avg Energy</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-red-50">
                      <Target className="h-3 w-3 text-red-500 mx-auto mb-1" />
                      <p className="text-sm font-bold text-red-700">{moodPatterns.averages.focus}</p>
                      <p className="text-[10px] text-red-600 mt-0.5">Avg Focus</p>
                    </div>
                  </div>

                  {/* Energy Pattern */}
                  {moodPatterns.energyPattern?.highestDay && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-lg bg-rose-50">
                        <p className="text-[10px] text-rose-600 mb-0.5">Highest Energy</p>
                        <p className="text-xs font-medium text-rose-800">{moodPatterns.energyPattern.highestDay.day}</p>
                        <p className="text-[10px] text-rose-600">Avg {moodPatterns.energyPattern.highestDay.avgEnergy}/10</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50">
                        <p className="text-[10px] text-slate-600 mb-0.5">Lowest Energy</p>
                        <p className="text-xs font-medium text-slate-800">{moodPatterns.energyPattern.lowestDay?.day || '—'}</p>
                        <p className="text-[10px] text-slate-600">Avg {moodPatterns.energyPattern.lowestDay?.avgEnergy || '—'}/10</p>
                      </div>
                    </div>
                  )}

                  {/* Focus-Mood Correlation + Best/Worst Day */}
                  <div className="space-y-2">
                    {moodPatterns.focusMoodCorrelation && moodPatterns.focusMoodCorrelation !== 'none' && (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50">
                        <span className="text-xs text-neutral-600">Focus ↔ Mood</span>
                        <Badge variant="outline" className="text-[10px]">
                          {moodPatterns.focusMoodCorrelation === 'positive' ? 'Move together ↑' :
                           moodPatterns.focusMoodCorrelation === 'negative' ? 'Move apart ↓' : 'Weak link'}
                        </Badge>
                      </div>
                    )}
                    {moodPatterns.bestDay && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded-lg bg-red-50">
                          <p className="text-[10px] text-red-600 mb-0.5">Best Day</p>
                          <p className="text-xs font-medium text-red-800">{formatDate(moodPatterns.bestDay.date)}</p>
                          <p className="text-[10px] text-red-600">M:{moodPatterns.bestDay.mood} E:{moodPatterns.bestDay.energy} F:{moodPatterns.bestDay.focus}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-neutral-50 border-l-2 border-neutral-300">
                          <p className="text-[10px] text-neutral-500 mb-0.5">Toughest Day</p>
                          <p className="text-xs font-medium text-neutral-700">{formatDate(moodPatterns.worstDay?.date || '')}</p>
                          <p className="text-[10px] text-neutral-500">M:{moodPatterns.worstDay?.mood || '—'} E:{moodPatterns.worstDay?.energy || '—'} F:{moodPatterns.worstDay?.focus || '—'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-neutral-400 py-2">{moodPatterns?.message || 'No mood data yet. Start logging!'}</p>
              )}
            </CardContent>
          </Card>

          {/* D. Life Area Progress */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-100 text-red-600">
                  <Target className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm">Life Area Progress</CardTitle>
                  <p className="text-[10px] text-neutral-400">{lifeAreaProgress.length} areas tracked</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {lifeAreaProgressLoading ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                  <span className="text-xs text-neutral-500">Loading...</span>
                </div>
              ) : lifeAreaProgress.length > 0 ? (
                <div className="space-y-3">
                  {lifeAreaProgress.map((area) => {
                    const config = getAreaConfig(area.area)
                    // Estimate a progress percentage from currentStatus text or default
                    const hasStatus = area.currentStatus && area.currentStatus.length > 5
                    const hasVision = area.idealVision && area.idealVision.length > 5
                    const hasActions = area.keyActions && area.keyActions.length > 5
                    const filledFields = [hasStatus, hasVision, hasActions].filter(Boolean).length
                    const progressPct = Math.round((filledFields / 3) * 100)

                    return (
                      <div key={area.area} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-neutral-700">{config.label}</span>
                          </div>
                          <span className="text-[10px] text-neutral-400">{progressPct}%</span>
                        </div>
                        <Progress value={progressPct} className="h-1.5" />
                        {area.currentStatus && (
                          <p className="text-[10px] text-neutral-500 truncate">{area.currentStatus}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-neutral-400 py-2">No life area progress set yet. Visit each life area to configure.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* =============== DRIFT ALERTS TAB =============== */}
        <TabsContent value="drift" className="mt-4 space-y-4 animate-slow-fade-up">
          {driftAlerts.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="p-8 text-center">
                <Shield className="h-12 w-12 text-red-400 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-neutral-700">No Active Drift Alerts</h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">You&apos;re on track! MyOS will alert you if any area starts drifting.</p>
              </CardContent>
            </Card>
          ) : (
            driftAlerts.map((alert) => {
              const config = getAreaConfig(alert.area)
              return (
                <Card key={alert.id} id={`item-${alert.id}`} className={`border-l-4 ${alert.severity === 'critical' ? 'border-l-red-600' : 'border-l-rose-500'} shadow-sm ${highlightItemId === alert.id && highlightItemType === 'alerts' ? 'ring-2 ring-rose-400 bg-rose-50 dark:bg-rose-950/30 animate-pulse' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">
                            {alert.severity}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {config.label}
                          </Badge>
                          <span className="text-[10px] text-neutral-400">{alert.date}</span>
                        </div>
                        <p className="text-sm text-neutral-700 leading-snug">{alert.message}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => {
                              useAppStore.getState().setActiveTab('chat')
                              setTimeout(() => {
                                window.dispatchEvent(new CustomEvent('myos-prefill-chat', { detail: { message: `I have a drift alert in my ${config.label} area: "${alert.message}". What specific actions should I take this week to correct this?` } }))
                              }, 100)
                            }}
                            className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium transition-colors"
                          >
                            <Brain className="h-3 w-3" />
                            Ask Coach
                          </button>
                          <button
                            onClick={() => useAppStore.getState().setActiveTab('habits')}
                            className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 font-medium transition-colors"
                          >
                            <Target className="h-3 w-3" />
                            Add Habit
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* =============== PATTERNS & MEMORY TAB =============== */}
        <TabsContent value="patterns" className="mt-4 space-y-4 animate-slow-fade-up">
          {Object.entries(groupedMemories).map(([type, items]) => {
            const config = memoryTypeConfig[type] || { label: type, icon: <Lightbulb className="h-4 w-4" />, color: 'text-neutral-600 bg-neutral-100' }
            return (
              <Card key={type} className="shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.color}`}>
                      {config.icon}
                    </div>
                    <div>
                      <CardTitle className="text-sm">{config.label}s</CardTitle>
                      <p className="text-[10px] text-neutral-400">{items.length} recorded</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2.5 max-h-96 overflow-y-auto">
                    {items.slice(0, 8).map((memory) => {
                      const areaConf = getAreaConfig(memory.area)
                      return (
                        <div key={memory.id} id={`item-${memory.id}`} className={`flex items-start gap-2 p-2.5 rounded-lg hover:bg-neutral-50 ${highlightItemId === memory.id && highlightItemType === 'memories' ? 'ring-2 ring-rose-400 bg-rose-50 dark:bg-rose-950/30 animate-pulse' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-neutral-700 leading-snug">{memory.content}</p>
                            <p className="text-[10px] text-neutral-400 mt-0.5">{areaConf.label} &bull; {memory.date}</p>
                          </div>
                        </div>
                      )
                    })}
                    {items.length > 8 && (
                      <p className="text-[10px] text-neutral-400 text-center py-1">+ {items.length - 8} more</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {memories.length === 0 && (
            <Card className="shadow-sm">
              <CardContent className="p-8 text-center">
                <Brain className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-neutral-700">Building Memory</h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">As you complete check-ins, MyOS will learn your patterns and store what matters.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* =============== CORRELATIONS TAB =============== */}
        <TabsContent value="correlations" className="mt-4 space-y-4 animate-slow-fade-up">
          <CorrelationsSection />
        </TabsContent>

        {/* =============== MONTHLY SUMMARY TAB =============== */}
        <TabsContent value="monthly" className="mt-4 space-y-4 animate-slow-fade-up">
          {/* Month Selector & Generate Button */}
          <Card className="shadow-sm border-l-4 border-l-rose-500">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-rose-100 text-rose-600">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">Monthly Summary</CardTitle>
                    <p className="text-[10px] text-neutral-400">AI-generated month in review for each life area</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={selectedSummaryMonth}
                  onChange={(e) => {
                    setSelectedSummaryMonth(e.target.value)
                    fetchMonthlySummaries(e.target.value)
                  }}
                  className="text-xs border rounded-md px-2 py-1.5 bg-white text-neutral-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
                <Button
                  onClick={handleGenerateSummary}
                  disabled={generatingSummary}
                  className="text-xs h-8 bg-neutral-900 hover:bg-neutral-800 text-white"
                >
                  {generatingSummary ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-1" />
                      Generate This Month&apos;s Summary
                    </>
                  )}
                </Button>
              </div>
              {generatingSummary && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50">
                  <Loader2 className="h-4 w-4 animate-spin text-rose-500" />
                  <span className="text-xs text-rose-700 leading-relaxed">AI is analyzing your data across all 7 life areas. This may take a minute...</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Cards per Area */}
          {monthlySummariesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
              <span className="text-sm text-neutral-500 ml-2">Loading summaries...</span>
            </div>
          ) : monthlySummaries.length > 0 ? (
            <div className="space-y-4">
              {monthlySummaries.map((summary) => {
                const config = getAreaConfig(summary.area)
                let highlights: string[] = []
                try {
                  highlights = summary.highlights ? JSON.parse(summary.highlights) : []
                } catch {
                  highlights = []
                }

                return (
                  <Card key={summary.id} className="shadow-sm">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div>
                            <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
                            <p className="text-[10px] text-neutral-400">{summary.month}</p>
                          </div>
                        </div>
                        {summary.score !== null && (
                          <div className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 text-rose-500" />
                            <span className={`text-sm font-bold ${
                              summary.score >= 7 ? 'text-red-600' :
                              summary.score >= 4 ? 'text-rose-600' :
                              'text-red-600'
                            }`}>
                              {summary.score}/10
                            </span>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      {/* Summary Text (rendered as markdown-lite) */}
                      <div className="prose prose-sm max-w-none text-xs text-neutral-700 leading-relaxed">
                        {summary.summary.split('\n').map((line, i) => {
                          if (line.startsWith('## ')) {
                            return <h3 key={i} className="text-sm font-semibold text-neutral-800 mt-3 mb-1">{line.replace('## ', '')}</h3>
                          }
                          if (line.startsWith('### ')) {
                            return <h4 key={i} className="text-xs font-semibold text-neutral-800 mt-2 mb-1">{line.replace('### ', '')}</h4>
                          }
                          if (line.startsWith('- ')) {
                            return <p key={i} className="pl-3 text-xs text-neutral-600">• {line.replace('- ', '')}</p>
                          }
                          if (line.startsWith('> ')) {
                            return <blockquote key={i} className="border-l-2 border-rose-300 pl-3 italic text-neutral-500 text-xs">{line.replace('> ', '')}</blockquote>
                          }
                          if (line.startsWith('**') && line.endsWith('**')) {
                            return <p key={i} className="font-semibold text-neutral-800 text-xs">{line.replace(/\*\*/g, '')}</p>
                          }
                          if (line.trim() === '') {
                            return <div key={i} className="h-1" />
                          }
                          // Handle inline bold
                          const parts = line.split(/(\*\*.*?\*\*)/g)
                          return (
                            <p key={i} className="text-xs text-neutral-600">
                              {parts.map((part, j) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                  return <strong key={j}>{part.replace(/\*\*/g, '')}</strong>
                                }
                                return part
                              })}
                            </p>
                          )
                        })}
                      </div>

                      {/* Highlights */}
                      {highlights.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[10px] font-medium text-neutral-500 mb-1.5">Key Highlights</p>
                          <div className="flex flex-wrap gap-1.5">
                            {highlights.map((h, idx) => (
                              <Badge key={idx} variant="secondary" className="text-[10px] bg-rose-50 text-rose-700 hover:bg-rose-100">
                                {h}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card className="shadow-sm">
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-neutral-700">No Monthly Summary Yet</h3>
                <p className="text-xs text-neutral-400 mt-1 mb-4 leading-relaxed">Generate an AI-powered review of all your life areas for the selected month.</p>
                <Button
                  onClick={handleGenerateSummary}
                  disabled={generatingSummary}
                  className="text-xs bg-neutral-900 hover:bg-neutral-800 text-white"
                >
                  {generatingSummary ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-1" />
                      Generate Summary
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Missing Areas - show areas without summaries */}
          {!monthlySummariesLoading && monthlySummaries.length > 0 && monthlySummaries.length < 7 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-neutral-500">Areas Without Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth']
                    .filter(area => !monthlySummaries.some(s => s.area === area))
                    .map(area => {
                      const config = getAreaConfig(area)
                      return (
                        <div key={area} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-neutral-50">
                          <span className="text-xs text-neutral-500">{config.label}</span>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* =============== FINANCIAL TAB =============== */}
        <TabsContent value="financial" className="mt-4 space-y-4 animate-slow-fade-up">
          {/* Detailed Finance Summary */}
          <Card className="shadow-sm border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-100 text-red-600">
                  <DollarSign className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm">Weekly Financial Auto-Tracking</CardTitle>
                  <p className="text-[10px] text-neutral-400">Automatically detected from your conversations</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {financeSummaryLoading ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                  <span className="text-xs text-neutral-500">Loading...</span>
                </div>
              ) : financeSummary ? (
                <div className="space-y-4">
                  {/* Summary Row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-red-50 text-center">
                      <ArrowUpRight className="h-4 w-4 text-red-600 mx-auto mb-1" />
                      <p className="text-lg font-bold text-red-700">{formatCurrency(financeSummary.totalReceived)}</p>
                      <p className="text-[10px] text-red-600 mt-0.5">Total Received</p>
                    </div>
                    <div className="p-3 rounded-lg bg-neutral-50 text-center">
                      <ArrowDownRight className="h-4 w-4 text-neutral-500 mx-auto mb-1" />
                      <p className="text-lg font-medium text-neutral-800">{formatCurrency(financeSummary.totalSpent)}</p>
                      <p className="text-[10px] text-neutral-500 mt-0.5">Total Spent</p>
                    </div>
                    <div className={`p-3 rounded-lg text-center ${financeSummary.netFlow >= 0 ? 'bg-red-50' : 'bg-rose-50'}`}>
                      <Activity className={`h-4 w-4 mx-auto mb-1 ${financeSummary.netFlow >= 0 ? 'text-red-600' : 'text-rose-600'}`} />
                      <p className={`text-lg font-bold ${financeSummary.netFlow >= 0 ? 'text-red-700' : 'text-rose-700'}`}>
                        {formatCurrency(financeSummary.netFlow)}
                      </p>
                      <p className={`text-[10px] mt-0.5 ${financeSummary.netFlow >= 0 ? 'text-red-600' : 'text-rose-600'}`}>Net Flow</p>
                    </div>
                  </div>

                  {/* Top Spending Categories */}
                  {financeSummary.topSpendingCategories.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-neutral-600 mb-2">Top Spending Categories</p>
                      <div className="space-y-2">
                        {financeSummary.topSpendingCategories.map((cat, idx) => {
                          const maxAmount = financeSummary.topSpendingCategories[0]?.amount || 1
                          const pct = Math.round((cat.amount / maxAmount) * 100)
                          return (
                            <div key={cat.category} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-neutral-600">{cat.category}</span>
                                <span className="text-xs font-medium text-neutral-700">{formatCurrency(cat.amount)}</span>
                              </div>
                              <div className="w-full bg-neutral-100 rounded-full h-1.5">
                                <div
                                  className="bg-red-400 h-1.5 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-neutral-400 py-2">No financial data this week.</p>
              )}
            </CardContent>
          </Card>

          {/* Auto-Detected Entries List */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-100 text-red-600">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm">Auto-Detected Transactions</CardTitle>
                  <p className="text-[10px] text-neutral-400">
                    {financeSummary?.autoDetectedCount || 0} entries detected from chat
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {financeSummary && financeSummary.autoDetectedEntries.length > 0 ? (
                <div className="space-y-2.5 max-h-96 overflow-y-auto">
                  {financeSummary.autoDetectedEntries.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2 p-2.5 rounded-lg hover:bg-neutral-50">
                      <span className="text-sm">{entry.type === 'received' ? '📥' : '📤'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-neutral-700">
                            {entry.type === 'received' ? '+' : '-'}{formatCurrency(entry.amount)}
                          </p>
                          <Badge variant="outline" className="text-[10px]">{entry.category}</Badge>
                        </div>
                        <p className="text-[10px] text-neutral-500">
                          {entry.purpose || 'No description'} &bull; {formatDate(entry.date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-400 py-2">No auto-detected transactions yet. They&apos;ll appear here when smart-sync detects financial mentions in your chats.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
