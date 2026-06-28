'use client'

import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  resetKey: number
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, resetKey: 0 }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
  }

  handleRetry = () => {
    // Reset our own error state and bump the reset key so any child that uses
    // it as a `key` prop is fully remounted (clearing local React state).
    // Also broadcast a global event so parents listening can bump their own
    // remount keys (e.g. the chat reset key in page.tsx).
    this.setState(prev => ({ hasError: false, error: null, resetKey: prev.resetKey + 1 }))
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('myos-reset-chat'))
      } catch {
        // ignore — dispatch is best-effort
      }
    }
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Truncate the error message so the fallback UI stays compact on mobile.
      const rawMessage = this.state.error?.message || this.state.error?.toString() || 'Unknown error'
      const truncatedMessage = rawMessage.length > 240 ? rawMessage.slice(0, 240) + '…' : rawMessage
      const errorName = this.state.error?.name || 'Error'

      return (
        <div className="flex flex-col items-center justify-center p-6 text-center min-h-[260px] max-w-md mx-auto">
          <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
            Something went wrong
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
            The AI Coach hit an unexpected error. You can try again or reload the page.
          </p>
          {/* Debug info — helps identify WHAT crashed without opening devtools */}
          <div className="w-full mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-left">
            <p className="text-[10px] font-mono text-red-700 dark:text-red-300 break-all leading-relaxed">
              <span className="font-bold">{errorName}: </span>
              <span className="text-red-600 dark:text-red-400">{truncatedMessage}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 active:bg-red-800 transition-colors min-h-[40px]"
            >
              Try Again
            </button>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-white dark:bg-neutral-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors min-h-[40px]"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
