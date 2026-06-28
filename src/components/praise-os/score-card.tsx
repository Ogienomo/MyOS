'use client'

import { LifeScore, useAppStore } from '@/lib/store'
import { AREA_KEYS, AREA_CONFIG, getAreaConfig } from '@/lib/area-config'

const areaConfig = AREA_KEYS.map(key => ({
  key: key as keyof LifeScore & string,
  label: AREA_CONFIG[key]?.label || getAreaConfig(key).label,
}))

// Map area accent to actual Tailwind stroke classes (must be static for purge)
const AREA_STROKE_CLASSES: Record<string, string> = {
  faith: 'stroke-violet-500',
  health: 'stroke-emerald-500',
  career: 'stroke-sky-500',
  havilah: 'stroke-amber-500',
  finances: 'stroke-teal-500',
  relationships: 'stroke-pink-500',
  personalGrowth: 'stroke-orange-500',
}

function getScoreColor(score: number): string {
  if (score <= 3) return 'text-red-800'
  if (score <= 5) return 'text-amber-600'
  if (score <= 7) return 'text-emerald-600'
  return 'text-emerald-500'
}

// Color-coded background tint based on score (kept — subtle, professional)
function getScoreBgTint(score: number): string {
  if (score <= 3) return 'bg-red-50/60 dark:bg-red-950/20'
  if (score <= 6) return 'bg-amber-50/60 dark:bg-amber-950/20'
  return 'bg-emerald-50/60 dark:bg-emerald-950/20'
}

// Small colored dot indicator (CSS only, no emoji)
function getScoreDotClass(score: number): string {
  if (score <= 3) return 'bg-red-800'
  if (score <= 6) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function getStatusLabel(score: number): { text: string; color: string } {
  if (score <= 3) return { text: 'Critical', color: 'text-red-700' }
  if (score <= 5) return { text: 'Needs Work', color: 'text-amber-600' }
  if (score <= 7) return { text: 'Growing', color: 'text-emerald-600' }
  return { text: 'Strong', color: 'text-emerald-500' }
}

function ScoreCircle({ score, label, stroke, onClick }: { score: number; label: string; stroke: string; onClick?: () => void }) {
  const circumference = 2 * Math.PI * 36
  const strokeDashoffset = circumference - (score / 10) * circumference

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${onClick ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}`}
    >
      <div className={`relative w-14 h-14 sm:w-20 sm:h-20 rounded-full p-1 ${getScoreBgTint(score)}`}>
        <svg className="w-12 h-12 sm:w-18 sm:h-18 -rotate-90" viewBox="0 0 80 80" style={{ width: 'calc(100% - 8px)', height: 'calc(100% - 8px)', margin: '4px' }}>
          <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6" className="text-neutral-100 dark:text-neutral-800" />
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={stroke}
            style={{ transition: 'stroke-dashoffset 0.9s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm sm:text-lg font-bold ${getScoreColor(score)}`}>{score}</span>
        </div>
      </div>
      <div className="text-center flex items-center justify-center gap-1.5">
        {score > 0 && <span className={`inline-block w-1.5 h-1.5 rounded-full ${getScoreDotClass(score)}`} aria-hidden="true" />}
        <p className="text-[10px] sm:text-xs font-medium text-neutral-600 dark:text-neutral-400">{label}</p>
        {score > 0 && <p className={`text-[8px] font-medium ${getStatusLabel(score).color}`}>{getStatusLabel(score).text}</p>}
      </div>
    </button>
  )
}

export function ScoreCard({ scores }: { scores: LifeScore | null }) {
  const { setActiveTab } = useAppStore()

  if (!scores) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-5 sm:p-6 shadow-sm">
        <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-4">Life Alignment Scores</h3>
        <div className="grid grid-cols-4 sm:flex sm:flex-wrap justify-items-center sm:justify-center gap-3 sm:gap-4">
          {areaConfig.map((area) => (
            <ScoreCircle
              key={area.key}
              score={0}
              label={area.label}
              stroke={AREA_STROKE_CLASSES[area.key] || 'stroke-neutral-400'}
              onClick={() => setActiveTab(area.key)}
            />
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 text-center">
          <p className="text-xs text-neutral-400 dark:text-neutral-500">No scores yet. Start a check-in to begin tracking.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Life Alignment Scores</h3>
        <span className="text-xs text-neutral-400 dark:text-neutral-500">{scores.date}</span>
      </div>
      <div className="grid grid-cols-4 sm:flex sm:flex-wrap justify-items-center sm:justify-center gap-3 sm:gap-6">
        {areaConfig.map((area) => (
          <ScoreCircle
            key={area.key}
            score={scores[area.key]}
            label={area.label}
            stroke={AREA_STROKE_CLASSES[area.key] || 'stroke-neutral-400'}
            onClick={() => setActiveTab(area.key)}
          />
        ))}
      </div>
      <div className={`mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between rounded-xl px-3 py-2 ${getScoreBgTint(scores.overall)}`}>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Overall Alignment</span>
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${getScoreDotClass(scores.overall)}`} aria-hidden="true" />
          <span className={`text-lg font-semibold ${getScoreColor(scores.overall)}`}>{scores.overall}/10 — {getStatusLabel(scores.overall).text}</span>
        </div>
      </div>
    </div>
  )
}
