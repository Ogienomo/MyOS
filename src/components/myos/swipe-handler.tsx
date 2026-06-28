'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'

export function SwipeHandler() {
  const { activeTab, setActiveTab } = useAppStore()
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return
      const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x
      const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y

      // Only trigger on horizontal swipes (not vertical scrolling)
      if (Math.abs(deltaX) > 80 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        const lifeAreas = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth'] as const
        const mainTabs = ['dashboard', 'chat', 'life', 'goals', 'more'] as const

        if (lifeAreas.includes(activeTab as typeof lifeAreas[number])) {
          const idx = lifeAreas.indexOf(activeTab as typeof lifeAreas[number])
          if (deltaX < 0 && idx < lifeAreas.length - 1) setActiveTab(lifeAreas[idx + 1] as typeof lifeAreas[number])
          if (deltaX > 0 && idx > 0) setActiveTab(lifeAreas[idx - 1] as typeof lifeAreas[number])
        } else if (mainTabs.includes(activeTab as typeof mainTabs[number])) {
          const idx = mainTabs.indexOf(activeTab as typeof mainTabs[number])
          if (deltaX < 0 && idx < mainTabs.length - 1) setActiveTab(mainTabs[idx + 1] as typeof mainTabs[number])
          if (deltaX > 0 && idx > 0) setActiveTab(mainTabs[idx - 1] as typeof mainTabs[number])
        }
      }

      touchStartRef.current = null
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [activeTab, setActiveTab])

  return null
}
