'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ArrowRight, CheckCircle2, ShieldCheck, User, Building2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'

const DEEP_GRADIENT = 'bg-gradient-to-br from-black via-neutral-950 to-red-950/40 ambient-gradient'

type AuthStep = 'boot' | 'checking' | 'setup-name' | 'setup-business' | 'setup-code' | 'login' | 'success'

// Boot sequence lines — PraiseOS-style
const BOOT_LINES = [
  { text: 'Initializing system...', ok: true, delay: 0 },
  { text: 'Loading Life OS kernel...', ok: true, delay: 400 },
  { text: 'Mounting database...', ok: true, delay: 800 },
  { text: 'Starting alignment engine...', ok: true, delay: 1200 },
  { text: 'System ready.', ok: true, delay: 1600 },
]

export function AuthGate() {
  const { setIsAuthenticated, setUserName, setOsName, setIsSetupComplete, setBusinessName, setBusinessDescription } = useAppStore()
  const [step, setStep] = useState<AuthStep>('boot')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [businessName, setLocalBusinessName] = useState('')
  const [businessDesc, setLocalBusinessDesc] = useState('')
  const [osNamePreview, setOsNamePreview] = useState('MyOS')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSetUp, setIsSetUp] = useState<boolean | null>(null)
  const [bootLineIndex, setBootLineIndex] = useState(-1)
  const [storedOsName, setStoredOsName] = useState('MyOS')
  const checkRan = useRef(false)

  // ─── Boot animation ───
  useEffect(() => {
    if (step !== 'boot') return

    let timeout: ReturnType<typeof setTimeout>
    let currentIndex = -1

    const showNext = () => {
      currentIndex++
      if (currentIndex < BOOT_LINES.length) {
        setBootLineIndex(currentIndex)
        timeout = setTimeout(showNext, 450)
      } else {
        // Boot done — transition to checking
        timeout = setTimeout(() => setStep('checking'), 300)
      }
    }

    timeout = setTimeout(showNext, 300)

    return () => clearTimeout(timeout)
  }, [step])

  // ─── Check if already authenticated or if auth is set up ───
  useEffect(() => {
    if (step !== 'checking') return
    if (checkRan.current) return
    checkRan.current = true

    const sessionAuth = localStorage.getItem('myos-auth')
    if (sessionAuth === 'true') {
      // Already authenticated in this session — load profile and enter
      const loadProfile = async () => {
        try {
          const res = await fetch('/api/user-profile')
          const data = await res.json()
          if (data.userName) {
            setUserName(data.userName)
            setOsName(data.osName || `${data.userName}OS`)
            setStoredOsName(data.osName || `${data.userName}OS`)
          }
          if (data.businessName) {
            setBusinessName(data.businessName)
          }
          if (data.businessDescription) {
            setBusinessDescription(data.businessDescription)
          }
          if (data.isSetupComplete) {
            setIsSetupComplete(true)
          }
        } catch { /* ignore */ }
        setIsAuthenticated(true)
      }
      loadProfile()
      return
    }

    // Check if auth is set up
    const checkAuth = async () => {
      try {
        const [authRes, profileRes] = await Promise.all([
          fetch('/api/auth'),
          fetch('/api/user-profile'),
        ])
        const authData = await authRes.json()
        const profileData = await profileRes.json()

        setIsSetUp(authData.isSetUp)

        // Store the OS name for the login screen
        if (profileData.osName && profileData.osName !== 'MyOS') {
          setStoredOsName(profileData.osName)
        }
        if (profileData.businessName) {
          setBusinessName(profileData.businessName)
        }
        if (profileData.businessDescription) {
          setBusinessDescription(profileData.businessDescription)
        }

        if (!authData.isSetUp || !profileData.isSetupComplete) {
          // Brand new user — show setup flow (name first, then business, then code)
          setStep('setup-name')
        } else {
          // Returning user — show login with their personalized OS name
          setStep('login')
        }
      } catch {
        setIsSetUp(false)
        setStep('setup-name')
      }
    }
    checkAuth()
  }, [step, setIsAuthenticated, setUserName, setOsName, setIsSetupComplete, setBusinessName, setBusinessDescription])

  // Update OS name preview when name changes
  useEffect(() => {
    if (name.trim()) {
      setOsNamePreview(`${name.trim()}OS`)
    } else {
      setOsNamePreview('MyOS')
    }
  }, [name])

  // Handle name submission (first run setup — step 1)
  const handleNameSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || name.trim().length < 2) {
      setError('Please enter your name (at least 2 characters)')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setUserName(data.userName)
        setOsName(data.osName)
        setStoredOsName(data.osName)
        setIsSetupComplete(true)
        setStep('setup-business')
      } else {
        setError(data.error || 'Failed to save name')
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [name, setUserName, setOsName, setIsSetupComplete])

  // Handle business profile submission (first run setup — step 2)
  const handleBusinessSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName.trim(),
          businessDescription: businessDesc.trim(),
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setBusinessName(data.businessName || businessName.trim())
        setBusinessDescription(data.businessDescription || businessDesc.trim())
        setStep('setup-code')
      } else {
        setError(data.error || 'Failed to save business info')
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [businessName, businessDesc, setBusinessName, setBusinessDescription])

  // Handle access code submission (setup or login)
  const handleCodeSubmit = useCallback(async (e: React.FormEvent) => {
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
        setStep('success')
        localStorage.setItem('myos-auth', 'true')
        // Brief delay for success animation
        setTimeout(() => {
          setIsAuthenticated(true)
        }, 1800)
      } else {
        setError(data.error || 'Invalid access code')
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [code, setIsAuthenticated])

  // ─── Boot screen ───
  if (step === 'boot') {
    return (
      <div className={`fixed inset-0 z-[100] flex items-center justify-center ${DEEP_GRADIENT}`} style={{ height: '100vh', height: '100dvh' }}>
        <div className="w-full max-w-md px-8">
          {/* ASCII-style OS logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 text-center"
          >
            <h1 className="text-3xl font-mono font-bold text-red-500 tracking-wider">LIFE OS</h1>
            <p className="text-neutral-500 font-mono text-xs mt-1">v2.0 — Alignment Engine</p>
          </motion.div>

          {/* Boot lines */}
          <div className="font-mono text-sm space-y-1.5">
            {BOOT_LINES.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={bootLineIndex >= i ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-2"
              >
                <span className="text-neutral-500">[</span>
                <span className={line.ok ? 'text-green-500 font-bold' : 'text-red-500 font-bold'}>
                  {bootLineIndex >= i ? '  OK  ' : '     '}
                </span>
                <span className="text-neutral-500">]</span>
                <span className="text-neutral-300">{line.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─── Checking state ───
  if (step === 'checking') {
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

  // Background decoration shared across steps
  const bgDecoration = (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-1/2 -left-1/4 w-[80vw] h-[80vw] bg-red-500/8 rounded-full blur-3xl" />
      <div className="absolute -bottom-1/3 -right-1/4 w-[70vw] h-[70vw] bg-red-700/10 rounded-full blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle, #dc2626 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)',
        }}
      />
    </div>
  )

  return (
    <AnimatePresence mode="wait">
      {step === 'setup-name' && (
        <motion.div
          key="setup-name"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.5 }}
          className={`fixed inset-0 z-[100] flex items-center justify-center ${DEEP_GRADIENT} overflow-y-auto overflow-x-hidden`}
          style={{ height: '100vh', height: '100dvh' }}
        >
          {bgDecoration}
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
                    Welcome
                  </h1>
                  <p className="text-neutral-400 text-[11px] mt-1.5 tracking-[0.18em] uppercase">
                    Set Up Your Life OS
                  </p>
                </motion.div>

                {/* Name Form */}
                <form onSubmit={handleNameSubmit}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.6 }}
                    className="space-y-5"
                  >
                    <div>
                      <label
                        htmlFor="user-name"
                        className="flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-100 mb-2.5 tracking-wide"
                      >
                        <User className="h-3.5 w-3.5 text-red-400" />
                        What is your name?
                      </label>
                      <Input
                        id="user-name"
                        type="text"
                        placeholder="Enter your first name"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value)
                          setError('')
                        }}
                        className="bg-white/5 border-red-500/30 text-white placeholder:text-neutral-400 text-center text-xl h-14 rounded-lg focus-visible:border-red-500 focus-visible:ring-red-500/40 focus-visible:ring-2 transition-all"
                        autoFocus
                        autoComplete="off"
                      />
                    </div>

                    {/* OS Name Preview */}
                    {name.trim() && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center"
                      >
                        <p className="text-neutral-400 text-xs">Your OS will be called</p>
                        <p className="text-red-400 text-lg font-bold mt-1">{osNamePreview}</p>
                      </motion.div>
                    )}

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
                      disabled={loading || !name.trim()}
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
                          Continue
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                </form>

                <p className="text-neutral-500 text-[10px] text-center mt-6 tracking-[0.18em] uppercase">
                  Aligned &bull; Disciplined &bull; Joyful
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}

      {step === 'setup-business' && (
        <motion.div
          key="setup-business"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.5 }}
          className={`fixed inset-0 z-[100] flex items-center justify-center ${DEEP_GRADIENT} overflow-y-auto overflow-x-hidden`}
          style={{ height: '100vh', height: '100dvh' }}
        >
          {bgDecoration}
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
                    <Building2 className="h-10 w-10 text-red-400 relative z-10" />
                  </motion.div>
                  <h1 className="text-3xl font-bold text-white tracking-tight">
                    Your Business
                  </h1>
                  <p className="text-neutral-400 text-[11px] mt-1.5 tracking-[0.18em] uppercase">
                    Tell us about what you do
                  </p>
                </motion.div>

                {/* Business Form */}
                <form onSubmit={handleBusinessSubmit}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.6 }}
                    className="space-y-5"
                  >
                    <div>
                      <label
                        htmlFor="business-name"
                        className="flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-100 mb-2.5 tracking-wide"
                      >
                        <Building2 className="h-3.5 w-3.5 text-red-400" />
                        What is your business name?
                      </label>
                      <Input
                        id="business-name"
                        type="text"
                        placeholder="e.g., Havilah Learning Hub, My Consulting, etc."
                        value={businessName}
                        onChange={(e) => {
                          setLocalBusinessName(e.target.value)
                          setError('')
                        }}
                        className="bg-white/5 border-red-500/30 text-white placeholder:text-neutral-400 text-center text-lg h-14 rounded-lg focus-visible:border-red-500 focus-visible:ring-red-500/40 focus-visible:ring-2 transition-all"
                        autoFocus
                        autoComplete="off"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="business-desc"
                        className="flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-100 mb-2.5 tracking-wide"
                      >
                        Describe your business
                      </label>
                      <textarea
                        id="business-desc"
                        placeholder="What does your business do? What products/services do you offer? Who are your clients?"
                        value={businessDesc}
                        onChange={(e) => {
                          setLocalBusinessDesc(e.target.value)
                          setError('')
                        }}
                        rows={3}
                        className="flex w-full rounded-lg border border-red-500/30 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:border-red-500 transition-all resize-none"
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
                      disabled={loading}
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
                          Continue
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>

                    <button
                      type="button"
                      onClick={() => {
                        setBusinessName('')
                        setBusinessDescription('')
                        setStep('setup-code')
                      }}
                      className="w-full text-center text-xs text-neutral-500 hover:text-neutral-300 transition-colors py-2"
                    >
                      Skip for now — I&apos;ll set this up later
                    </button>
                  </motion.div>
                </form>

                <p className="text-neutral-500 text-[10px] text-center mt-6 tracking-[0.18em] uppercase">
                  Aligned &bull; Disciplined &bull; Joyful
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}

      {step === 'setup-code' && (
        <motion.div
          key="setup-code"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.5 }}
          className={`fixed inset-0 z-[100] flex items-center justify-center ${DEEP_GRADIENT} overflow-y-auto overflow-x-hidden`}
          style={{ height: '100vh', height: '100dvh' }}
        >
          {bgDecoration}
          <div className="relative z-10 w-full min-h-full flex items-center justify-center py-4">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 w-full max-w-md mx-4"
            >
              <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 p-8 md:p-10">
                {/* Logo — shows personalized OS name */}
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
                    {osNamePreview}
                  </h1>
                  <p className="text-neutral-400 text-[11px] mt-1.5 tracking-[0.18em] uppercase">
                    Life Operating System
                  </p>
                </motion.div>

                {/* Code Form */}
                <form onSubmit={handleCodeSubmit}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.6 }}
                    className="space-y-5"
                  >
                    <div>
                      <label
                        htmlFor="setup-access-code"
                        className="flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-100 mb-2.5 tracking-wide"
                      >
                        <ShieldCheck className="h-3.5 w-3.5 text-red-400" />
                        Create Your Access Code
                      </label>
                      <Input
                        id="setup-access-code"
                        type="password"
                        placeholder="Choose an access code"
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
                          Create & Enter
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                </form>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="text-neutral-400 text-xs text-center mt-5"
                >
                  This code will protect your data. Remember it!
                </motion.p>

                <p className="text-neutral-500 text-[10px] text-center mt-6 tracking-[0.18em] uppercase">
                  Aligned &bull; Disciplined &bull; Joyful
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}

      {step === 'login' && (
        <motion.div
          key="auth-gate"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.7 }}
          className={`fixed inset-0 z-[100] flex items-center justify-center ${DEEP_GRADIENT} overflow-y-auto overflow-x-hidden`}
          style={{ height: '100vh', height: '100dvh' }}
        >
          {bgDecoration}
          <div className="relative z-10 w-full min-h-full flex items-center justify-center py-4">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 w-full max-w-md mx-4"
            >
              <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 p-8 md:p-10">
                {/* Logo — shows the USER'S personalized OS name */}
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
                    {storedOsName}
                  </h1>
                  <p className="text-neutral-400 text-[11px] mt-1.5 tracking-[0.18em] uppercase">
                    Life Operating System
                  </p>
                </motion.div>

                {/* Form */}
                <form onSubmit={handleCodeSubmit}>
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

                {/* Footer text */}
                <p className="text-neutral-500 text-[10px] text-center mt-6 tracking-[0.18em] uppercase">
                  Aligned &bull; Disciplined &bull; Joyful
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}

      {step === 'success' && (
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
              {isSetUp ? 'Welcome back' : `Welcome to ${storedOsName}`}
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
