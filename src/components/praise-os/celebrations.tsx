'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'

// Subtle confetti — simple shapes only (no emoji particles), fewer pieces, slower fall
type ConfettiShape = 'circle' | 'square'

const CONFETTI_SHAPES: ConfettiShape[] = ['circle', 'square']

// Simple confetti using framer-motion (no CSS animation classes required)
export function CelebrationOverlay() {
  const [show, setShow] = useState(false)
  const [message, setMessage] = useState('')
  const { dashboardData } = useAppStore()

  useEffect(() => {
    // Check for milestones
    if (!dashboardData) return

    const milestones: string[] = []
    const streaks = dashboardData.streaks
    const overallStreak = streaks.find(s => s.type === 'overall')
    const moodStreak = streaks.find(s => s.type === 'mood')

    // First mood log
    if (moodStreak?.currentStreak === 1) {
      milestones.push('First Mood Log. You are on your way.')
    }

    // 3-day streak
    if (overallStreak?.currentStreak === 3) {
      milestones.push('3-Day Streak. The pattern is forming.')
    }

    // 7-day streak
    if (overallStreak?.currentStreak === 7) {
      milestones.push('7-Day Streak. Keep it going.')
    }

    // 10-day streak
    if (overallStreak?.currentStreak === 10) {
      milestones.push('10-Day Streak. Discipline is compounding.')
    }

    // First goal completed
    if (dashboardData.goalStats.completed === 1) {
      milestones.push('First Goal Completed. Progress confirmed.')
    }

    if (milestones.length > 0) {
      const milestone = milestones[0]
      const storageKey = 'myos-celebrated-' + milestone
      if (!localStorage.getItem(storageKey)) {
        setMessage(milestone)
        setShow(true)
        localStorage.setItem(storageKey, 'true')
        setTimeout(() => setShow(false), 4000)
      }
    }
  }, [dashboardData])

  if (!show) return null

  // Subtle confetti — fewer particles (24), slower fall (3-5s), gentle fade.
  // Muted, professional palette.
  const confettiItems = Array.from({ length: 24 }).map((_, i) => {
    const shape: ConfettiShape = CONFETTI_SHAPES[i % CONFETTI_SHAPES.length]
    const colors = ['#ef4444', '#f97316', '#eab308', '#fde68a', '#fecaca', '#fed7aa']
    return {
      id: i,
      shape,
      left: Math.random() * 100,
      color: colors[i % colors.length],
      delay: Math.random() * 1.2,
      duration: 3 + Math.random() * 2,
    }
  })

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      {/* Subtle confetti — simple shapes only */}
      <div className="absolute inset-0 overflow-hidden">
        {confettiItems.map((item) => (
          <motion.div
            key={item.id}
            className={`absolute ${item.shape === 'circle' ? 'w-2 h-2 rounded-full' : 'w-2 h-2'}`}
            style={{ left: `${item.left}%`, backgroundColor: item.color, opacity: 0.7 }}
            initial={{ y: '-10vh', opacity: 0 }}
            animate={{ y: '110vh', opacity: [0, 0.7, 0.7, 0] }}
            transition={{
              duration: item.duration,
              delay: item.delay,
              ease: 'easeIn',
              repeat: 0,
            }}
          />
        ))}
      </div>
      {/* Message card — calm, clean fade-in */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-xl px-8 py-6 z-10 text-center"
      >
        <p className="text-lg font-semibold text-neutral-900 dark:text-white">{message}</p>
      </motion.div>
    </div>
  )
}
