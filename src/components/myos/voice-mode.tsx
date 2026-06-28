'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { Mic, MicOff } from 'lucide-react'

const POS_STORAGE_KEY = 'myos-voice-btn-pos'
const TOOLTIP_DISMISSED_KEY = 'myos-voice-tooltip-dismissed'

function loadPos() {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  try {
    const saved = localStorage.getItem(POS_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return parsed
      }
    }
  } catch {}
  return { x: window.innerWidth - 80, y: 20 }
}

function savePos(pos: { x: number; y: number }) {
  try {
    localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(pos))
  } catch {}
}

function isTooltipDismissed() {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(TOOLTIP_DISMISSED_KEY) === 'true'
  } catch {
    return true
  }
}

function dismissTooltip() {
  try {
    localStorage.setItem(TOOLTIP_DISMISSED_KEY, 'true')
  } catch {}
}

function clampToBounds(pos: { x: number; y: number }) {
  const btnSize = 40
  const maxX = window.innerWidth - btnSize
  const maxY = window.innerHeight - btnSize
  return {
    x: Math.max(0, Math.min(pos.x, maxX)),
    y: Math.max(0, Math.min(pos.y, maxY)),
  }
}

export function VoiceMode() {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const { setActiveTab } = useAppStore()

  // Drag state — lazy initializers for client-only values (SSR-safe fallbacks)
  const [pos, setPos] = useState(loadPos)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [showTooltip, setShowTooltip] = useState(() => !isTooltipDismissed())
  const [mounted, setMounted] = useState(false)

  const dragStartPos = useRef({ x: 0, y: 0 })
  const hasMoved = useRef(false)

  // Mark as mounted so we can render client-only UI
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard mount detection pattern
    setMounted(true)
  }, [])

  // Handle window resize — re-clamp position
  useEffect(() => {
    if (!mounted) return
    const handleResize = () => {
      setPos(prev => {
        const clamped = clampToBounds(prev)
        savePos(clamped)
        return clamped
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [mounted])

  // Pointer move / up handlers attached to window during drag
  useEffect(() => {
    if (!isDragging) return

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault()
      const newPos = clampToBounds({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      })
      setPos(newPos)

      const dx = e.clientX - dragStartPos.current.x
      const dy = e.clientY - dragStartPos.current.y
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved.current = true
      }
    }

    const handlePointerUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isDragging, dragOffset])

  // Save position when drag ends
  useEffect(() => {
    if (!isDragging && mounted) {
      savePos(pos)
    }
  }, [isDragging, pos, mounted])

  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1
      utterance.pitch = 1
      window.speechSynthesis.speak(utterance)
    }
  }, [])

  const processCommand = useCallback((command: string) => {
    const tabMap: Record<string, string> = {
      'dashboard': 'dashboard',
      'home': 'dashboard',
      'chat': 'chat',
      'coach': 'chat',
      'life': 'life',
      'goals': 'goals',
      'finances': 'finances',
      'finance': 'finances',
      'journal': 'journal',
      'habits': 'habits',
      'insights': 'insights',
      'calendar': 'calendar',
      'mood': 'moodLog',
      'faith': 'faith',
      'health': 'health',
      'career': 'career',
    }

    for (const [keyword, tab] of Object.entries(tabMap)) {
      if (command.includes(keyword)) {
        setActiveTab(tab as any)
        speak(`Opening ${keyword}`)
        return
      }
    }

    if (command.includes('check-in') || command.includes('check in')) {
      setActiveTab('chat')
      speak('Opening AI coach for check-in')
    } else {
      speak("I heard: " + command + ". I can navigate to tabs, log moods, or start check-ins.")
    }
  }, [setActiveTab, speak])

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice commands are not supported in this browser')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)

    recognition.onresult = (event: any) => {
      const command = event.results[0][0].transcript.toLowerCase()
      setTranscript(command)
      processCommand(command)
    }

    recognition.onerror = () => setListening(false)
    recognition.start()
  }, [processCommand])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const rect = (e.target as HTMLElement).getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top

    setDragOffset({ x: offsetX, y: offsetY })
    dragStartPos.current = { x: e.clientX, y: e.clientY }
    hasMoved.current = false
    setIsDragging(true)

    // Dismiss tooltip on first interaction
    if (showTooltip) {
      setShowTooltip(false)
      dismissTooltip()
    }
  }, [showTooltip])

  const handlePointerUp = useCallback(() => {
    // If the pointer barely moved, treat it as a click
    if (!hasMoved.current) {
      startListening()
    }
    setIsDragging(false)
  }, [startListening])

  if (!mounted) return null

  return (
    <>
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerEnter={() => setIsHovering(true)}
        onPointerLeave={() => setIsHovering(false)}
        className="fixed z-40 md:hidden"
        style={{
          left: pos.x,
          top: pos.y,
          transition: isDragging ? 'none' : 'left 0.2s ease, top 0.2s ease',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {/* Tooltip */}
        {showTooltip && !isDragging && (
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap
              bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800
              text-[10px] px-2 py-1 rounded-md shadow-lg pointer-events-none
              animate-in fade-in-0 zoom-in-95 duration-200"
          >
            Drag to move &bull; Tap to speak
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="border-4 border-transparent border-t-neutral-800 dark:border-t-neutral-200" />
            </div>
          </div>
        )}

        {/* Drag handle indicator (4 dots) — visible on hover */}
        <div
          className={`absolute -top-1 -left-1 transition-opacity duration-200 ${
            isHovering || isDragging ? 'opacity-60' : 'opacity-0'
          }`}
        >
          <div className="grid grid-cols-2 gap-[2px] w-3 h-3">
            <span className="w-[3px] h-[3px] rounded-full bg-neutral-400 dark:bg-neutral-500" />
            <span className="w-[3px] h-[3px] rounded-full bg-neutral-400 dark:bg-neutral-500" />
            <span className="w-[3px] h-[3px] rounded-full bg-neutral-400 dark:bg-neutral-500" />
            <span className="w-[3px] h-[3px] rounded-full bg-neutral-400 dark:bg-neutral-500" />
          </div>
        </div>

        {/* Main button */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing ${
            listening
              ? 'bg-red-600 animate-pulse'
              : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
          } ${isDragging ? 'scale-110 shadow-2xl' : 'scale-100'} transition-[transform,box-shadow] duration-150`}
        >
          {listening ? (
            <MicOff className="h-4 w-4 text-white" />
          ) : (
            <Mic className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
          )}
        </div>
      </div>

      {/* Listening overlay */}
      {listening && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center md:hidden">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-2xl text-center max-w-[280px]">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3 animate-pulse">
              <Mic className="h-8 w-8 text-red-600" />
            </div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Listening...</p>
            <p className="text-xs text-neutral-400 mt-1">Say a command like &quot;Open goals&quot; or &quot;Log mood&quot;</p>
            {transcript && (
              <p className="text-xs text-red-600 mt-2 italic">&quot;{transcript}&quot;</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
