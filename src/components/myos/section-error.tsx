'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SectionErrorProps {
  message?: string
  onRetry?: () => void
}

export function SectionError({ message = 'Something went wrong loading this section.', onRetry }: SectionErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center mb-4">
        <AlertCircle className="h-7 w-7 text-red-500" />
      </div>
      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Failed to load</p>
      <p className="text-xs text-neutral-400 dark:text-neutral-500 max-w-[220px] mb-4">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </Button>
      )}
    </div>
  )
}
