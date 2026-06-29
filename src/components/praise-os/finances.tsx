'use client'

import { useState, useEffect, useCallback } from 'react'
import { FinancesSkeleton } from './loading-skeleton'
import { useAppStore, FinanceEntry } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { useToast } from '@/hooks/use-toast'
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  X,
  Target,
  PiggyBank,
  BarChart3,
  PieChart as PieIcon,
  Trash2,
  Pencil,
  Flame,
  CalendarClock,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrendsData {
  monthly: { month: string; received: number; spent: number; net: number }[]
  burnRate: number
  runwayDays: number
  netBalance: number
  categoryBreakdown: {
    category: string
    amount: number
    count: number
    type: string
    percentage: number
  }[]
  thisMonth: { received: number; spent: number; net: number }
  lastMonth: { received: number; spent: number; net: number }
}

interface SavingsGoal {
  id: string
  name: string
  targetAmount: number
  savedAmount: number
  deadline: string | null
  area: string | null
  createdAt: string
  updatedAt: string
}

// ─── Chart Configs ───────────────────────────────────────────────────────────

const trendChartConfig = {
  received: { label: 'Income', color: 'hsl(0, 72%, 51%)' },
  spent: { label: 'Expenses', color: 'hsl(350, 89%, 60%)' },
} satisfies ChartConfig

const CATEGORY_COLORS = [
  'hsl(0, 84%, 60%)',   // red-500
  'hsl(350, 89%, 60%)', // rose-500
  'hsl(0, 73%, 50%)',   // red-600
  'hsl(355, 78%, 55%)', // rose-600
  'hsl(0, 63%, 44%)',   // red-700
  'hsl(347, 77%, 50%)', // rose-700
  'hsl(0, 84%, 71%)',   // red-400
  'hsl(350, 89%, 71%)', // rose-400
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNaira(amount: number): string {
  return '₦' + Math.abs(amount).toLocaleString()
}

function getMonthLabel(monthStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const [, m] = monthStr.split('-')
  return months[parseInt(m, 10) - 1] || monthStr
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Finances() {
  const { finances, financesLoading, setFinances, setFinancesLoading, lastSyncTimestamp, highlightItemId, highlightItemType, clearHighlightItem } = useAppStore()
  const { toast } = useToast()

  // ─── Highlight item from search navigation ─────────────────────────────
  useEffect(() => {
    if (!highlightItemId || highlightItemType !== 'finances') return

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

  // Local state for trends & savings
  const [trendsData, setTrendsData] = useState<TrendsData | null>(null)
  const [trendsLoading, setTrendsLoading] = useState(false)
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([])
  const [savingsLoading, setSavingsLoading] = useState(false)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<'received' | 'spent'>('received')
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    category: '',
    purpose: '',
    aligned: true,
    notes: '',
  })

  // Savings form state
  const [showSavingsForm, setShowSavingsForm] = useState(false)
  const [savingsFormData, setSavingsFormData] = useState({
    name: '',
    targetAmount: '',
    savedAmount: '',
    deadline: '',
    area: '',
  })

  // Quick add amount state for each goal
  const [quickAddGoalId, setQuickAddGoalId] = useState<string | null>(null)
  const [quickAddAmount, setQuickAddAmount] = useState('')

  // Edit & Delete state
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState({
    date: '',
    amount: '',
    category: '',
    purpose: '',
    aligned: true,
    notes: '',
    type: 'received' as 'received' | 'spent',
  })
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // ─── Fetch functions ─────────────────────────────────────────────────────

  const fetchFinances = useCallback(async () => {
    try {
      setFinancesLoading(true)
      const today = new Date()
      const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, 1)
      const res = await fetch(`/api/finances?from=${sixMonthsAgo.toISOString().split('T')[0]}&to=${today.toISOString().split('T')[0]}`)
      const data = await res.json()
      setFinances(data.entries || [])
    } catch (err) {
      console.error('Failed to fetch finances:', err)
    } finally {
      setFinancesLoading(false)
    }
  }, [setFinances, setFinancesLoading])

  const fetchTrends = useCallback(async () => {
    try {
      setTrendsLoading(true)
      const res = await fetch('/api/finances/trends?months=6')
      const data = await res.json()
      setTrendsData(data)
    } catch (err) {
      console.error('Failed to fetch trends:', err)
    } finally {
      setTrendsLoading(false)
    }
  }, [])

  const fetchSavings = useCallback(async () => {
    try {
      setSavingsLoading(true)
      const res = await fetch('/api/savings-goals')
      const data = await res.json()
      setSavingsGoals(data.goals || [])
    } catch (err) {
      console.error('Failed to fetch savings goals:', err)
    } finally {
      setSavingsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFinances()
    fetchTrends()
    fetchSavings()
  }, [fetchFinances, fetchTrends, fetchSavings, lastSyncTimestamp])

  // ─── Finance entry submit ────────────────────────────────────────────────

  const handleSubmit = async () => {
    try {
      await fetch('/api/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          type: formType,
          amount: parseFloat(formData.amount) || 0,
        }),
      })
      setShowForm(false)
      setFormData({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        category: '',
        purpose: '',
        aligned: true,
        notes: '',
      })
      // Refresh all data
      await Promise.all([fetchFinances(), fetchTrends()])
      toast({ title: 'Entry logged', description: 'Your finance entry has been saved.' })
    } catch (err) {
      console.error('Failed to create finance entry:', err)
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' })
    }
  }

  // ─── Savings goal submit ─────────────────────────────────────────────────

  const handleSavingsSubmit = async () => {
    try {
      await fetch('/api/savings-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: savingsFormData.name,
          targetAmount: parseFloat(savingsFormData.targetAmount) || 0,
          savedAmount: parseFloat(savingsFormData.savedAmount) || 0,
          deadline: savingsFormData.deadline || null,
          area: savingsFormData.area || null,
        }),
      })
      setShowSavingsForm(false)
      setSavingsFormData({ name: '', targetAmount: '', savedAmount: '', deadline: '', area: '' })
      await fetchSavings()
      toast({ title: 'Entry logged', description: 'Your savings goal has been saved.' })
    } catch (err) {
      console.error('Failed to create savings goal:', err)
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' })
    }
  }

  const handleQuickAdd = async (goalId: string) => {
    const amount = parseFloat(quickAddAmount) || 0
    if (amount <= 0) return
    try {
      await fetch('/api/savings-goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: goalId, addAmount: amount }),
      })
      setQuickAddGoalId(null)
      setQuickAddAmount('')
      await fetchSavings()
      toast({ title: 'Entry logged', description: 'Savings updated.' })
    } catch (err) {
      console.error('Failed to add to savings goal:', err)
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' })
    }
  }

  const handleDeleteGoal = async (goalId: string) => {
    try {
      await fetch(`/api/savings-goals?id=${goalId}`, { method: 'DELETE' })
      await fetchSavings()
      toast({ title: 'Entry removed', description: 'Savings goal has been deleted.' })
    } catch (err) {
      console.error('Failed to delete savings goal:', err)
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' })
    }
  }

  // ─── Edit & Delete finance entries ──────────────────────────────────────────

  const handleEdit = (entry: FinanceEntry) => {
    setEditingEntryId(entry.id)
    setEditFormData({
      date: entry.date,
      amount: entry.amount.toString(),
      category: entry.category,
      purpose: entry.purpose || '',
      aligned: entry.aligned !== false,
      notes: entry.notes || '',
      type: entry.type as 'received' | 'spent',
    })
  }

  const handleEditSubmit = async () => {
    if (!editingEntryId) return
    try {
      await fetch('/api/finances', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingEntryId,
          ...editFormData,
          amount: parseFloat(editFormData.amount) || 0,
        }),
      })
      setEditingEntryId(null)
      await Promise.all([fetchFinances(), fetchTrends()])
      toast({ title: 'Entry logged', description: 'Finance entry has been updated.' })
    } catch (err) {
      console.error('Failed to update entry:', err)
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/finances?id=${id}`, { method: 'DELETE' })
      setDeleteConfirmId(null)
      await Promise.all([fetchFinances(), fetchTrends()])
      toast({ title: 'Entry removed', description: 'Finance entry has been deleted.' })
    } catch (err) {
      console.error('Failed to delete entry:', err)
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' })
    }
  }

  // ─── Computed values ─────────────────────────────────────────────────────

  const totalReceived = finances.filter(f => f.type === 'received').reduce((acc, f) => acc + f.amount, 0)
  const totalSpent = finances.filter(f => f.type === 'spent').reduce((acc, f) => acc + f.amount, 0)
  const net = totalReceived - totalSpent

  // Build category chart config dynamically
  const spentCategories = trendsData?.categoryBreakdown.filter(c => c.type === 'spent') || []
  const receivedCategories = trendsData?.categoryBreakdown.filter(c => c.type === 'received') || []
  const categoryChartConfig: ChartConfig = {}
  spentCategories.forEach((cat, i) => {
    categoryChartConfig[cat.category] = {
      label: cat.category,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }
  })

  // Pie chart data
  const pieData = spentCategories.map((cat, i) => ({
    name: cat.category,
    value: cat.amount,
    fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }))

  // ─── Loading state ───────────────────────────────────────────────────────

  if (financesLoading && finances.length === 0) {
    return <FinancesSkeleton />
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100">Finances</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Track every naira. Stay financially aware.</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-red-600 hover:bg-red-700 text-white"
          size="sm"
        >
          <Plus className="mr-1 h-4 w-4" />
          Add Entry
        </Button>
      </div>

      {/* Net Cash Flow Banner */}
      {trendsData && (
        <div className={`rounded-2xl border p-4 flex items-center justify-between ${net >= 0 ? 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900' : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900'}`}>
          <div className="space-y-0.5">
            <p className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">This Month — Net</p>
            <p className={`text-2xl font-bold ${net >= 0 ? 'text-red-700 dark:text-red-400' : 'text-rose-700 dark:text-rose-400'}`}>
              {net >= 0 ? '+' : ''}{formatNaira(net)}
            </p>
          </div>
          <div className="text-right space-y-1">
            <div className="flex items-center justify-end gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-400">
              <ArrowUpRight className="h-3.5 w-3.5 text-red-500" />
              <span>{formatNaira(trendsData.thisMonth.received)}</span>
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-400">
              <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" />
              <span>{formatNaira(trendsData.thisMonth.spent)}</span>
            </div>
            {trendsData.lastMonth.net !== 0 && (
              <p className="text-[10px] text-neutral-400">
                vs last mo: {trendsData.lastMonth.net >= 0 ? '+' : ''}{formatNaira(trendsData.lastMonth.net)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Add Entry Form */}
      {showForm && (
        <Card className="border-red-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">New Finance Entry</CardTitle>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded">
                <X className="h-4 w-4 text-neutral-400" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex gap-2">
              <button
                onClick={() => setFormType('received')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  formType === 'received'
                    ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800'
                    : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700'
                }`}
              >
                <ArrowUpRight className="inline h-4 w-4 mr-1" />
                Money Received
              </button>
              <button
                onClick={() => setFormType('spent')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  formType === 'spent'
                    ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                    : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700'
                }`}
              >
                <ArrowDownRight className="inline h-4 w-4 mr-1" />
                Money Spent
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs block mb-1.5">Amount (₦)</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0"
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs block mb-1.5">Date</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="text-sm"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs block mb-1.5">Category</Label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                placeholder={formType === 'received' ? 'e.g., Client payment, Salary' : 'e.g., Transport, Food, Data'}
                className="text-sm"
              />
            </div>

            <div>
              <Label className="text-xs block mb-1.5">Purpose</Label>
              <Input
                value={formData.purpose}
                onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                placeholder="What was this for?"
                className="text-sm"
              />
            </div>

            {formType === 'spent' && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.aligned}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, aligned: checked }))}
                />
                <Label className="text-xs text-neutral-600 dark:text-neutral-400">Aligned with goals</Label>
              </div>
            )}

            <div>
              <Label className="text-xs block mb-1.5">Notes (optional)</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional notes"
                className="text-sm min-h-[60px] resize-none"
              />
            </div>

            <Button onClick={handleSubmit} className="w-full bg-red-600 hover:bg-red-700 text-white">
              Add {formType === 'received' ? 'Income' : 'Expense'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-auto p-1">
          <TabsTrigger value="overview" className="text-xs py-1.5">
            <Wallet className="h-3.5 w-3.5 mr-1 hidden sm:inline-block" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="trends" className="text-xs py-1.5">
            <BarChart3 className="h-3.5 w-3.5 mr-1 hidden sm:inline-block" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="categories" className="text-xs py-1.5">
            <PieIcon className="h-3.5 w-3.5 mr-1 hidden sm:inline-block" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="savings" className="text-xs py-1.5">
            <Target className="h-3.5 w-3.5 mr-1 hidden sm:inline-block" />
            Savings
          </TabsTrigger>
        </TabsList>

        {/* ─── OVERVIEW TAB ──────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <ArrowUpRight className="h-4 w-4 text-red-500" />
                  <span className="text-[10px] text-neutral-500">Received</span>
                </div>
                <p className="text-lg font-bold text-red-600">{formatNaira(totalReceived)}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <ArrowDownRight className="h-4 w-4 text-rose-500" />
                  <span className="text-[10px] text-neutral-500">Spent</span>
                </div>
                <p className="text-lg font-bold text-rose-600">{formatNaira(totalSpent)}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <DollarSign className="h-4 w-4 text-red-500" />
                  <span className="text-[10px] text-neutral-500">Net</span>
                </div>
                <p className={`text-lg font-bold ${net >= 0 ? 'text-red-600' : 'text-red-800'}`}>
                  {net < 0 ? '-' : ''}{formatNaira(net)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* This Month vs Last Month */}
          {trendsData && (
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs border-red-200 text-red-700">
                <TrendingUp className="h-3 w-3 mr-1" />
                This month: {formatNaira(trendsData.thisMonth.received)} in / {formatNaira(trendsData.thisMonth.spent)} out
              </Badge>
              <Badge variant="outline" className="text-xs border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400">
                Last month: {formatNaira(trendsData.lastMonth.received)} in / {formatNaira(trendsData.lastMonth.spent)} out
              </Badge>
              {trendsData.lastMonth.spent > 0 && trendsData.thisMonth.spent > 0 && (
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    trendsData.thisMonth.spent > trendsData.lastMonth.spent
                      ? 'border-rose-200 text-rose-700'
                      : 'border-red-200 text-red-700'
                  }`}
                >
                  {trendsData.thisMonth.spent > trendsData.lastMonth.spent ? (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  )}
                  Spending {trendsData.thisMonth.spent > trendsData.lastMonth.spent ? 'up' : 'down'} {Math.abs(Math.round(((trendsData.thisMonth.spent - trendsData.lastMonth.spent) / trendsData.lastMonth.spent) * 100))}%
                </Badge>
              )}
            </div>
          )}

          {/* Recent Entries */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Entries</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {finances.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-6">No entries yet. Start tracking your finances.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {finances.map((entry) => (
                    <div key={entry.id} id={`item-${entry.id}`} className={`rounded-lg ${highlightItemId === entry.id && highlightItemType === 'finances' ? 'ring-2 ring-rose-400 bg-rose-50 dark:bg-rose-950/30 animate-pulse' : ''}`}>
                      <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          entry.type === 'received' ? 'bg-red-100' : 'bg-rose-100'
                        }`}>
                          {entry.type === 'received'
                            ? <ArrowUpRight className="h-4 w-4 text-red-600" />
                            : <ArrowDownRight className="h-4 w-4 text-rose-600" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 truncate">{entry.category}</p>
                          <p className="text-[10px] text-neutral-400 truncate">{entry.purpose || entry.notes || entry.date}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-semibold ${entry.type === 'received' ? 'text-red-600' : 'text-rose-600'}`}>
                            {entry.type === 'received' ? '+' : '-'}{formatNaira(entry.amount)}
                          </p>
                          {entry.aligned === false && (
                            <Badge variant="destructive" className="text-[8px] py-0 px-1">Not aligned</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleEdit(entry)}
                            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                            title="Edit entry"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(entry.id)}
                            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-rose-50 text-neutral-400 hover:text-rose-600 transition-colors"
                            title="Delete entry"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Inline Edit Form */}
                      {editingEntryId === entry.id && (
                        <div className="mt-2 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg space-y-3 border border-red-100 dark:border-red-900/30">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditFormData(prev => ({ ...prev, type: 'received' }))}
                              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                                editFormData.type === 'received'
                                  ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800'
                                  : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700'
                              }`}
                            >
                              <ArrowUpRight className="inline h-4 w-4 mr-1" />
                              Money Received
                            </button>
                            <button
                              onClick={() => setEditFormData(prev => ({ ...prev, type: 'spent' }))}
                              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                                editFormData.type === 'spent'
                                  ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                                  : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700'
                              }`}
                            >
                              <ArrowDownRight className="inline h-4 w-4 mr-1" />
                              Money Spent
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs block mb-1.5">Amount (₦)</Label>
                              <Input
                                type="number"
                                value={editFormData.amount}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, amount: e.target.value }))}
                                placeholder="0"
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs block mb-1.5">Date</Label>
                              <Input
                                type="date"
                                value={editFormData.date}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, date: e.target.value }))}
                                className="text-sm"
                              />
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs block mb-1.5">Category</Label>
                            <Input
                              value={editFormData.category}
                              onChange={(e) => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                              placeholder={editFormData.type === 'received' ? 'e.g., Client payment, Salary' : 'e.g., Transport, Food, Data'}
                              className="text-sm"
                            />
                          </div>

                          <div>
                            <Label className="text-xs block mb-1.5">Purpose</Label>
                            <Input
                              value={editFormData.purpose}
                              onChange={(e) => setEditFormData(prev => ({ ...prev, purpose: e.target.value }))}
                              placeholder="What was this for?"
                              className="text-sm"
                            />
                          </div>

                          {editFormData.type === 'spent' && (
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={editFormData.aligned}
                                onCheckedChange={(checked) => setEditFormData(prev => ({ ...prev, aligned: checked }))}
                              />
                              <Label className="text-xs text-neutral-600 dark:text-neutral-400">Aligned with goals</Label>
                            </div>
                          )}

                          <div>
                            <Label className="text-xs block mb-1.5">Notes (optional)</Label>
                            <Textarea
                              value={editFormData.notes}
                              onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                              placeholder="Any additional notes"
                              className="text-sm min-h-[60px] resize-none"
                            />
                          </div>

                          <div className="flex gap-2">
                            <Button onClick={handleEditSubmit} className="bg-red-600 hover:bg-red-700 text-white">
                              Save Changes
                            </Button>
                            <Button variant="outline" onClick={() => setEditingEntryId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Finance Entry?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this entry. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                  className="bg-rose-600 hover:bg-rose-700"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        {/* ─── TRENDS TAB ─────────────────────────────────────────────────── */}
        <TabsContent value="trends" className="space-y-4 mt-4">
          {trendsLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-red-600" />
            </div>
          ) : (
            <>
              {/* Monthly Income vs Expense Line Chart */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Monthly Income vs Expenses</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {trendsData && trendsData.monthly.length > 0 ? (
                    <ChartContainer config={trendChartConfig} className="h-[250px] sm:h-[300px] w-full">
                      <LineChart data={trendsData.monthly} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tickFormatter={getMonthLabel}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          tickFormatter={(v: number) => `₦${(v / 1000).toFixed(0)}k`}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11 }}
                          width={50}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Line
                          type="monotone"
                          dataKey="received"
                          stroke="var(--color-received)"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="spent"
                          stroke="var(--color-spent)"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                      <BarChart3 className="h-8 w-8 mb-2" />
                      <p className="text-xs">No trend data yet. Add some finance entries first.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Burn Rate & Runway */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Flame className="h-4 w-4 text-red-500" />
                      <span className="text-[10px] text-neutral-500">Daily Burn Rate</span>
                    </div>
                    <p className="text-lg font-bold text-red-600">
                      {trendsData ? `${formatNaira(trendsData.burnRate)}/day` : '—'}
                    </p>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <CalendarClock className="h-4 w-4 text-neutral-500" />
                      <span className="text-[10px] text-neutral-500">Runway</span>
                    </div>
                    <p className={`text-lg font-bold ${
                      !trendsData ? 'text-neutral-400' :
                      trendsData.runwayDays === Infinity ? 'text-red-600' :
                      trendsData.runwayDays > 30 ? 'text-red-600' :
                      trendsData.runwayDays >= 14 ? 'text-red-700' :
                      'text-red-800'
                    }`}>
                      {trendsData
                        ? trendsData.runwayDays === Infinity
                          ? '∞ days'
                          : `${trendsData.runwayDays} days`
                        : '—'}
                    </p>
                    {trendsData && trendsData.runwayDays !== Infinity && (
                      <p className="text-[10px] text-neutral-400">until ₦0 at current rate</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <DollarSign className="h-4 w-4 text-neutral-500" />
                      <span className="text-[10px] text-neutral-500">Net Balance</span>
                    </div>
                    <p className={`text-lg font-bold ${
                      trendsData
                        ? trendsData.netBalance >= 0 ? 'text-red-600' : 'text-red-800'
                        : 'text-neutral-400'
                    }`}>
                      {trendsData
                        ? `${trendsData.netBalance < 0 ? '-' : ''}${formatNaira(trendsData.netBalance)}`
                        : '—'}
                    </p>
                    <p className="text-[10px] text-neutral-400">all time</p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ─── CATEGORIES TAB ─────────────────────────────────────────────── */}
        <TabsContent value="categories" className="space-y-4 mt-4">
          {trendsLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-red-600" />
            </div>
          ) : (
            <>
              {/* Spending Donut Chart */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Spending by Category</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {pieData.length > 0 ? (
                    <ChartContainer config={categoryChartConfig} className="h-[250px] sm:h-[300px] w-full mx-auto">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                          nameKey="name"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                      <PieIcon className="h-8 w-8 mb-2" />
                      <p className="text-xs">No spending data yet. Add some expenses first.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Detailed Spending Breakdown */}
              {spentCategories.length > 0 && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Spending Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {spentCategories
                        .sort((a, b) => b.amount - a.amount)
                        .map((cat, i) => (
                          <div key={cat.category} className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 truncate">{cat.category}</span>
                                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 shrink-0 ml-2">
                                  {formatNaira(cat.amount)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-neutral-100 dark:bg-neutral-700 rounded-full h-1.5">
                                  <div
                                    className="h-1.5 rounded-full"
                                    style={{
                                      width: `${cat.percentage}%`,
                                      backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                                    }}
                                  />
                                </div>
                                <span className="text-[10px] text-neutral-400 shrink-0 w-10 text-right">
                                  {cat.percentage.toFixed(1)}%
                                </span>
                              </div>
                              <div className="flex gap-3 mt-1">
                                <span className="text-[10px] text-neutral-400">{cat.count} transaction{cat.count !== 1 ? 's' : ''}</span>
                                <span className="text-[10px] text-neutral-400">Avg: {formatNaira(cat.count > 0 ? cat.amount / cat.count : 0)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Income Categories */}
              {receivedCategories.length > 0 && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Income by Category</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {receivedCategories
                        .sort((a, b) => b.amount - a.amount)
                        .map((cat) => (
                          <div key={cat.category} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                            <div className="flex items-center gap-2">
                              <ArrowUpRight className="h-3.5 w-3.5 text-red-500" />
                              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{cat.category}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-semibold text-red-600">{formatNaira(cat.amount)}</span>
                              <span className="text-[10px] text-neutral-400 ml-2">{cat.count}x</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ─── SAVINGS TAB ────────────────────────────────────────────────── */}
        <TabsContent value="savings" className="space-y-4 mt-4">
          {/* Add Savings Goal Button */}
          <div className="flex justify-end">
            <Button
              onClick={() => setShowSavingsForm(!showSavingsForm)}
              className="bg-red-600 hover:bg-red-700 text-white"
              size="sm"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Savings Goal
            </Button>
          </div>

          {/* Add Savings Goal Form */}
          {showSavingsForm && (
            <Card className="border-red-200 dark:border-red-900/30 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">New Savings Goal</CardTitle>
                  <button onClick={() => setShowSavingsForm(false)} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded">
                    <X className="h-4 w-4 text-neutral-400" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label className="text-xs block mb-1.5">Goal Name</Label>
                  <Input
                    value={savingsFormData.name}
                    onChange={(e) => setSavingsFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Emergency Fund, Laptop"
                    className="text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs block mb-1.5">Target Amount (₦)</Label>
                    <Input
                      type="number"
                      value={savingsFormData.targetAmount}
                      onChange={(e) => setSavingsFormData(prev => ({ ...prev, targetAmount: e.target.value }))}
                      placeholder="0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs block mb-1.5">Already Saved (₦)</Label>
                    <Input
                      type="number"
                      value={savingsFormData.savedAmount}
                      onChange={(e) => setSavingsFormData(prev => ({ ...prev, savedAmount: e.target.value }))}
                      placeholder="0"
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs block mb-1.5">Deadline (optional)</Label>
                    <Input
                      type="date"
                      value={savingsFormData.deadline}
                      onChange={(e) => setSavingsFormData(prev => ({ ...prev, deadline: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs block mb-1.5">Life Area (optional)</Label>
                    <Input
                      value={savingsFormData.area}
                      onChange={(e) => setSavingsFormData(prev => ({ ...prev, area: e.target.value }))}
                      placeholder="e.g., career, business"
                      className="text-sm"
                    />
                  </div>
                </div>

                <Button onClick={handleSavingsSubmit} className="w-full bg-red-600 hover:bg-red-700 text-white">
                  Create Savings Goal
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Savings Goals List */}
          {savingsLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-red-600" />
            </div>
          ) : savingsGoals.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-neutral-400">
                  <PiggyBank className="h-10 w-10 mb-2" />
                  <p className="text-sm font-medium">No savings goals yet</p>
                  <p className="text-xs">Create a goal to start tracking your savings progress.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {savingsGoals.map((goal) => {
                const progress = goal.targetAmount > 0
                  ? Math.min(100, (goal.savedAmount / goal.targetAmount) * 100)
                  : 0
                const isComplete = progress >= 100

                return (
                  <Card key={goal.id} className={`shadow-sm ${isComplete ? 'border-red-200 dark:border-red-800' : 'border-neutral-200 dark:border-neutral-700'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{goal.name}</h4>
                          <p className="text-xs text-neutral-500">
                            {formatNaira(goal.savedAmount)} / {formatNaira(goal.targetAmount)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setQuickAddGoalId(quickAddGoalId === goal.id ? null : goal.id)}
                            className="p-1.5 rounded-md hover:bg-red-50 text-red-600"
                            title="Add money"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteGoal(goal.id)}
                            className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400"
                            title="Delete goal"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <Progress
                        value={progress}
                        className={`h-2.5 ${isComplete ? '[&>[data-slot=progress-indicator]]:bg-red-600' : ''}`}
                      />

                      <div className="flex items-center justify-between mt-3">
                        <span className={`text-xs font-semibold ${
                          isComplete ? 'text-red-600' : 'text-red-700'
                        }`}>
                          {progress.toFixed(1)}%
                        </span>
                        <div className="flex items-center gap-2">
                          {goal.area && (
                            <Badge variant="outline" className="text-[10px] py-0">
                              {goal.area}
                            </Badge>
                          )}
                          {goal.deadline && (
                            <Badge variant="outline" className="text-[10px] py-0">
                              <CalendarClock className="h-2.5 w-2.5 mr-0.5" />
                              {goal.deadline}
                            </Badge>
                          )}
                          {isComplete && (
                            <Badge className="text-[10px] py-0 bg-red-600">Complete!</Badge>
                          )}
                        </div>
                      </div>

                      {/* Quick Add Money */}
                      {quickAddGoalId === goal.id && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-100">
                          <Input
                            type="number"
                            value={quickAddAmount}
                            onChange={(e) => setQuickAddAmount(e.target.value)}
                            placeholder="Amount to add"
                            className="text-sm h-8"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleQuickAdd(goal.id)
                            }}
                          />
                          <Button
                            onClick={() => handleQuickAdd(goal.id)}
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white h-8 shrink-0"
                          >
                            Add ₦
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
