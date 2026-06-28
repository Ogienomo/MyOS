'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { useTheme } from 'next-themes'

export function DarkModeSync() {
  const { userSettings } = useAppStore()
  const { setTheme } = useTheme()

  useEffect(() => {
    // Sync store darkMode setting with next-themes
    const isDark = userSettings?.darkMode ?? false
    setTheme(isDark ? 'dark' : 'light')

    // Set color-scheme for native form controls
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
  }, [userSettings?.darkMode, setTheme])

  return null
}
