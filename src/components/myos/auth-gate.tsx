'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'

const DEEP_GRADIENT = 'bg-gradient-to-br from-black via-neutral-950 to-red-950/40 ambient-gradient'

export function AuthGate() {
  const { setIsAuthenticated } = useAppStore()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [isSetUp, setIsSetUp] = useState<boolean | null>(null)

  // Check if already authenticated or if auth is set up
  useEffect(() => {
    const sessionAuth = localStorage.getItem('myos-auth')
    if (sessionAuth === 'true') {
      setIsAuthenticated(true)
      return
    }

    // Check if auth is set up
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth')
        const data = await res.json()
        setIsSetUp(data.isSetUp)
      } catch {
        setIsSetUp(false)
      }
    }
    checkAuth()
  }, [setIsAuthenticated])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) {
      setError('Please enter an access code')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setSuccess(true)
        localStorage.setItem('myos-auth', 'true')
        // Brief delay for success animation
        setTimeout(() => {
          setIsAuthenticated(true)
        }, 1200)
      } else {
        setError(data.error || 'Invalid access code')
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [code, setIsAuthenticated])

  // Still checking auth status
  if (isSetUp === null) {
    return (
      <div className={`fixed inset-0 z-[100] flex items-center justify-center ${DEEP_GRADIENT}`} style={{ height: '100vh', height: '100dvh' }}>
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.6, repeat: Infinity }}
          className="relative z-10"
        >
          <Sparkles className="h-8 w-8 text-red-400 animate-slow-pulse" />
        </motion.div>
      </div>
    )
  }

  return (
    <AnimatePresence>
      {!success ? (
        <motion.div
          key="auth-gate"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.7 }}
          className={`fixed inset-0 z-[100] flex items-center justify-center ${DEEP_GRADIENT} overflow-y-auto overflow-x-hidden`}
          style={{ height: '100vh', height: '100dvh' }}
        >
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-1/2 -left-1/4 w-[80vw] h-[80vw] bg-red-500/8 rounded-full blur-3xl" />
            <div className="absolute -bottom-1/3 -right-1/4 w-[70vw] h-[70vw] bg-red-700/10 rounded-full blur-3xl" />
            {/* Subtle grid pattern */}
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: 'radial-gradient(circle, #dc2626 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
            {/* Vignette */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)',
              }}
            />
          </div>

          <div className="relative z-10 w-full min-h-full flex items-center justify-center py-4">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-md mx-4"
          >
            <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 p-8 md:p-10">
              {/* Logo */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex flex-col items-center mb-8"
              >
                <motion.div
                  className="relative flex items-center justify-center w-20 h-20 rounded-3xl bg-red-600/15 border border-red-500/30 mb-5 overflow-hidden animate-color-sweep"
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                >
                  <Sparkles className="h-10 w-10 text-red-400 relative z-10" />
                </motion.div>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  MyOS
                </h1>
                <p className="text-neutral-400 text-[11px] mt-1.5 tracking-[0.18em] uppercase">
                  Life Operating System
                </p>
              </motion.div>

              {/* Form */}
              <form onSubmit={handleSubmit}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.6 }}
                  className="space-y-5"
                >
                  <div>
                    <label
                      htmlFor="access-code"
                      className="flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-100 mb-2.5 tracking-wide"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-red-400" />
                      Enter Access Code
                    </label>
                    <Input
                      id="access-code"
                      type="password"
                      placeholder="Enter your access code"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value)
                        setError('')
                      }}
                      className="bg-white/5 border-red-500/30 text-white placeholder:text-neutral-400 text-center text-xl tracking-[0.2em] h-14 rounded-lg focus-visible:border-red-500 focus-visible:ring-red-500/40 focus-visible:ring-2 transition-all"
                      autoFocus
                      autoComplete="off"
                    />
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-red-400 text-xs text-center font-medium"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <Button
                    type="submit"
                    disabled={loading || !code.trim()}
                    className="w-full h-14 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold text-base rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-red-900/40 hover:shadow-red-700/40"
                  >
                    {loading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                        className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                    ) : (
                      <>
                        Unlock
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </motion.div>
              </form>

              {/* First time hint */}
              {isSetUp === false && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="text-neutral-400 text-xs text-center mt-5"
                >
                  First time? Use your initial setup code.
                </motion.p>
              )}

              {/* Footer text */}
              <p className="text-neutral-500 text-[10px] text-center mt-6 tracking-[0.18em] uppercase">
                Aligned &bull; Disciplined &bull; Joyful
              </p>
            </div>
          </motion.div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="auth-success"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 z-[100] flex items-center justify-center ${DEEP_GRADIENT}`}
          style={{ height: '100vh', height: '100dvh' }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="flex flex-col items-center relative z-10"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
              className="mb-5"
            >
              <CheckCircle2 className="h-16 w-16 text-red-400" />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-white text-lg font-medium"
            >
              Welcome back
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-neutral-400 text-sm mt-1.5"
            >
              Access granted
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
