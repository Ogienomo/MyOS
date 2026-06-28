'use client'

import { useState, useEffect } from 'react'
import { useAppStore, LifeScore, LifeAreaProgress } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Heart, Activity, Briefcase, Gem, Wallet, Users, Sprout,
  ArrowRight, TrendingUp, TrendingDown, Minus, Loader2, Flame, Sparkles,
} from 'lucide-react'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

const AREAS = [
  { key: 'faith', label: 'Faith', icon: Heart, ideal: 9, desc: 'Prayer, scripture, devotion' },
  { key: 'health', label: 'Health', icon: Activity, ideal: 8, desc: 'Sleep, food, gym, energy' },
  { key: 'career', label: 'Career', icon: Briefcase, ideal: 8, desc: 'Applications, skills, CV' },
  { key: 'havilah', label: 'Havilah', icon: Gem, ideal: 8, desc: 'Revenue, clients, systems' },
  { key: 'finances', label: 'Finances', icon: Wallet, ideal: 8, desc: 'Savings, budgeting, giving' },
  { key: 'relationships', label: 'Relationships', icon: Users, ideal: 8, desc: 'Family, friends, church' },
  { key: 'personalGrowth', label: 'Growth', icon: Sprout, ideal: 8, desc: 'Learning, reading, discipline' },
]

function getTrend(scores: LifeScore[], key: keyof LifeScore): 'up' | 'down' | 'stable' | 'none' {
  const relevant = scores.map(s => s[key] as number).filter(v => v > 0)
  if (relevant.length < 2) return 'none'
  const recent = relevant.slice(-3)
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length
  const older = relevant.slice(0, -3)
  if (older.length === 0) return 'stable'
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length
  if (avg > olderAvg + 0.5) return 'up'
  if (avg < olderAvg - 0.5) return 'down'
  return 'stable'
}

function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'up': return <TrendingUp className="h-4 w-4 text-neutral-700" />
    case 'down': return <TrendingDown className="h-4 w-4 text-neutral-400" />
    case 'stable': return <Minus className="h-4 w-4 text-neutral-400" />
    default: return <Minus className="h-4 w-4 text-neutral-300" />
  }
}

export function LifeTab() {
  const { scores, setActiveTab } = useAppStore()
  const [progress, setProgress] = useState<LifeAreaProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const res = await fetch('/api/life-area')
        const data = await res.json()
        setProgress(data.progress || data.records || [])
      } catch (err) {
        console.error('Failed to fetch life area progress:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProgress()
  }, [])

  const latestScore = scores.length > 0 ? scores[scores.length - 1] : null

  const radarData = AREAS.map(area => ({
    area: area.label,
    current: latestScore ? (latestScore[area.key as keyof LifeScore] as number) : 0,
    ideal: area.ideal,
  }))

  const getProgressForArea = (areaKey: string) => progress.find(p => p.area === areaKey)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 rounded-2xl p-3 sm:p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Flame className="h-5 w-5 sm:h-6 sm:w-6 text-neutral-400" />
          <h1 className="text-xl sm:text-2xl font-medium">Life Overview</h1>
        </div>
        <p className="text-xs sm:text-sm text-neutral-400">Your ideal vs. current reality across all 7 life areas.</p>
      </div>

      {/* Radar Chart */}
      <Card className="shadow-sm border-neutral-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-neutral-700">Life Alignment Radar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 sm:h-72 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e5e5e5" />
                <PolarAngleAxis dataKey="area" tick={{ fontSize: 9, fill: '#737373' }} />
                <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 9 }} />
                <Radar name="Ideal" dataKey="ideal" stroke="#d4d4d4" fill="#d4d4d4" fillOpacity={0.2} />
                <Radar name="Current" dataKey="current" stroke="#525252" fill="#525252" fillOpacity={0.15} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-neutral-300 border border-neutral-400" />
              <span className="text-xs text-neutral-500">Ideal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-neutral-600 border border-neutral-700" />
              <span className="text-xs text-neutral-500">Current</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Area Cards */}
      <div className="space-y-3">
        {AREAS.map((area) => {
          const currentScore = latestScore ? (latestScore[area.key as keyof LifeScore] as number) : 0
          const trend = getTrend(scores, area.key as keyof LifeScore)
          const areaProgress = getProgressForArea(area.key)
          const gap = area.ideal - currentScore
          const Icon = area.icon

          return (
            <Card key={area.key} className="shadow-sm border-neutral-200 hover:border-neutral-300 transition-colors cursor-pointer" onClick={() => setActiveTab(area.key as 'faith' | 'health' | 'career' | 'havilah' | 'finances' | 'relationships' | 'personalGrowth')}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-neutral-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-xs sm:text-sm font-medium text-neutral-800">{area.label}</span>
                        <TrendIcon trend={trend} />
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <span className="text-base sm:text-lg font-medium text-neutral-800">{currentScore}</span>
                        <span className="text-[10px] sm:text-xs text-neutral-400">/ {area.ideal}</span>
                      </div>
                    </div>
                    <p className="text-[10px] sm:text-xs text-neutral-500 mb-1.5 sm:mb-2">{area.desc}</p>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Progress value={(currentScore / area.ideal) * 100} className="h-1.5 flex-1" />
                      {gap > 2 && (
                        <Badge variant="secondary" className="text-[9px] shrink-0 bg-neutral-100 text-neutral-600 border-neutral-200">Gap: {gap}</Badge>
                      )}
                      {gap <= 2 && currentScore > 0 && (
                        <Badge className="text-[9px] shrink-0 bg-neutral-100 text-neutral-700 border-neutral-200">On Track</Badge>
                      )}
                    </div>
                    {areaProgress?.currentStatus && (
                      <p className="text-[10px] text-neutral-400 mt-1 sm:mt-1.5 line-clamp-2">
                        Current: {areaProgress.currentStatus}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 text-neutral-300 shrink-0" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
