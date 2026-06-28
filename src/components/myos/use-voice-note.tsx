'use client'

/**
 * use-voice-note.ts
 *
 * Reusable voice note hook + button component for the MyOS app.
 *
 * PRIMARY METHOD: Web Speech API (window.SpeechRecognition || webkitSpeechRecognition)
 *   - continuous = true, interimResults = true, lang = 'en-US'
 *   - onend auto-restarts recognition unless the user manually stopped
 *     (mobile browsers stop SpeechRecognition after a few seconds of silence)
 *   - final transcripts are deduped via a Set<string> (lowercased) to avoid
 *     duplicate words when browsers re-emit the same final result
 *
 * FALLBACK METHOD: MediaRecorder + /api/asr (base64 audio → transcription)
 *   - used when Web Speech API is not supported or errors out
 *
 * Transcribed text is APPENDED to the existing value (not replaced).
 *
 * Reference implementation: src/components/praise-os/chat.tsx
 *
 * Color palette is RED-ONLY (red-50/100/200/400/500/600/700) per app convention.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, Square, AlertCircle, X, Loader2 } from 'lucide-react'

// 10 minutes — matches the chat.tsx reference implementation
const MAX_RECORDING_TIME = 600

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// ─── Hook types ─────────────────────────────────────────────────────────────

export interface VoiceNoteOptions {
  /** Called with the accumulated text (existing value + new transcript). */
  onTranscript: (text: string) => void
  /** Existing text to append the new transcript to. */
  currentValue?: string
}

export interface VoiceNoteResult {
  isRecording: boolean
  recordingTime: number
  interimTranscript: string
  voiceError: string | null
  isTranscribing: boolean
  voiceMethod: 'web-speech' | 'media-recorder' | null
  startRecording: () => Promise<void> | void
  stopRecording: () => void
  clearError: () => void
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useVoiceNote(options: VoiceNoteOptions): VoiceNoteResult {
  const { onTranscript, currentValue } = options

  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [voiceMethod, setVoiceMethod] = useState<'web-speech' | 'media-recorder' | null>(null)

  // Refs to avoid stale closures inside event handlers and timers
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Accumulated final transcript for the CURRENT recording session. Reset on
  // start. Initialized to the existing textarea value so new text appends to it.
  const finalTextRef = useRef('')
  // Lowercased final transcripts seen this session — dedupes re-emitted finals
  const processedFinalsRef = useRef<Set<string>>(new Set())
  // Latest props (so callbacks always read fresh values)
  const currentValueRef = useRef(currentValue ?? '')
  const onTranscriptRef = useRef(onTranscript)
  // Mirror isRecording into a ref for use inside timer callbacks
  const isRecordingRef = useRef(false)

  useEffect(() => {
    currentValueRef.current = currentValue ?? ''
  }, [currentValue])
  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])

  const cleanupTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current)
      recordingTimeoutRef.current = null
    }
  }, [])

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const clearError = useCallback(() => {
    setVoiceError(null)
  }, [])

  // ─── MediaRecorder + ASR fallback ──────────────────────────────────────────

  const transcribeAudio = useCallback(async (base64Audio: string) => {
    setIsTranscribing(true)
    setVoiceError(null)
    try {
      const res = await fetch('/api/asr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_base64: base64Audio }),
      })
      const data = await res.json()
      if (data.success && data.transcription) {
        const base = (currentValueRef.current || '').trim()
        const combined = base ? `${base} ${data.transcription}` : data.transcription
        onTranscriptRef.current(combined)
        setVoiceError(null)
      } else {
        setVoiceError(
          data.error ||
            'Could not transcribe your voice note. Please try again or type instead.'
        )
      }
    } catch (err) {
      console.error('ASR transcription error:', err)
      setVoiceError(
        'Voice transcription service is unavailable right now. Please type instead, or try again later.'
      )
    } finally {
      setIsTranscribing(false)
    }
  }, [])

  // NOTE: `stopRecording` is declared below as a useCallback. The reference
  // inside the timer closure is resolved at invocation time, so the TDZ is
  // not an issue (mirrors the chat.tsx reference implementation pattern).
  const startMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      let mimeType = ''
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', '']
      for (const type of mimeTypes) {
        if (!type || MediaRecorder.isTypeSupported(type)) {
          mimeType = type
          break
        }
      }

      const opts = mimeType ? { mimeType } : undefined
      const mediaRecorder = new MediaRecorder(stream, opts)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onerror = () => {
        cleanupStream()
        cleanupTimers()
        setIsRecording(false)
        isRecordingRef.current = false
        setVoiceMethod(null)
        mediaRecorderRef.current = null
        setVoiceError(
          'Recording failed. Your microphone may be in use by another app. Please try again or type instead.'
        )
      }

      mediaRecorder.onstop = async () => {
        cleanupStream()
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        // If we have no meaningful audio (e.g. user stopped immediately),
        // skip transcription and clean up.
        if (chunksRef.current.length === 0 || blob.size < 1000) {
          setIsRecording(false)
          isRecordingRef.current = false
          setVoiceMethod(null)
          cleanupTimers()
          return
        }
        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1]
          if (base64) {
            await transcribeAudio(base64)
          }
        }
        reader.onerror = () => {
          setIsTranscribing(false)
          setVoiceError('Failed to process audio. Please try again or type instead.')
        }
        reader.readAsDataURL(blob)
      }

      mediaRecorder.start()
      setVoiceMethod('media-recorder')
      setIsRecording(true)
      isRecordingRef.current = true
      setRecordingTime(0)
      setVoiceError(null)

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const next = prev + 1
          if (next >= MAX_RECORDING_TIME) {
            stopRecording()
          }
          return next
        })
      }, 1000)

      recordingTimeoutRef.current = setTimeout(() => {
        if (isRecordingRef.current) {
          stopRecording()
        }
      }, (MAX_RECORDING_TIME + 1) * 1000)
    } catch (err: any) {
      console.error('Microphone access error:', err)
      cleanupStream()
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setVoiceError(
          'Microphone access was denied. Please allow microphone access in your browser settings, or type instead.'
        )
      } else if (err?.name === 'NotFoundError') {
        setVoiceError('No microphone found. Please connect a microphone or type instead.')
      } else if (err?.name === 'NotReadableError') {
        setVoiceError(
          'Microphone is being used by another app. Please close other apps using the mic, or type instead.'
        )
      } else {
        setVoiceError('Could not access microphone. Please check your browser settings or type instead.')
      }
    }
  }

  // ─── Start recording (Web Speech API primary, MediaRecorder fallback) ──────

  const startRecording = async () => {
    setVoiceError(null)

    const SpeechRecognition =
      (typeof window !== 'undefined' &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
      null
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined'
    const hasGetUserMedia = !!(
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia
    )

    if (!SpeechRecognition && (!hasMediaRecorder || !hasGetUserMedia)) {
      setVoiceError(
        'Voice input is not supported in this browser. Please use Chrome or Edge for voice notes, or type instead.'
      )
      return
    }

    // Capture the existing textarea value as the starting point for appending
    finalTextRef.current = (currentValueRef.current || '').trim()
    processedFinalsRef.current = new Set()

    // PRIMARY: Web Speech API
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognitionRef.current = recognition
        setVoiceMethod('web-speech')
        setIsRecording(true)
        isRecordingRef.current = true
        setRecordingTime(0)
        setVoiceError(null)

        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => {
            const next = prev + 1
            if (next >= MAX_RECORDING_TIME) {
              stopRecording()
            }
            return next
          })
        }, 1000)

        recordingTimeoutRef.current = setTimeout(() => {
          if (recognitionRef.current) {
            stopRecording()
          }
        }, (MAX_RECORDING_TIME + 1) * 1000)

        // Dedup final transcripts to prevent duplicate words/phrases that occur
        // when some browsers re-emit the same final result multiple times.
        recognition.onresult = (event: any) => {
          let interimText = ''
          let newFinalText = ''
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i]
            const transcript = result[0].transcript
            if (result.isFinal) {
              const candidate = transcript.trim().toLowerCase()
              if (candidate && !processedFinalsRef.current.has(candidate)) {
                processedFinalsRef.current.add(candidate)
                newFinalText += transcript + ' '
              }
            } else {
              interimText += transcript
            }
          }
          if (newFinalText.trim()) {
            // APPEND to existing value (don't overwrite pre-existing text)
            const base = finalTextRef.current
            const combined = base ? `${base} ${newFinalText.trim()}` : newFinalText.trim()
            finalTextRef.current = combined
            onTranscriptRef.current(combined)
          }
          setInterimTranscript(interimText)
        }

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error)
          cleanupTimers()
          setInterimTranscript('')
          setIsRecording(false)
          isRecordingRef.current = false
          recognitionRef.current = null

          if (event.error === 'not-allowed') {
            if (hasMediaRecorder && hasGetUserMedia) {
              startMediaRecorder()
            } else {
              setVoiceError(
                'Microphone access was denied. Please allow microphone access or type instead.'
              )
            }
          } else if (event.error === 'no-speech') {
            setVoiceError(
              'No speech was detected. Please try again in a quieter environment, or type instead.'
            )
          } else if (event.error === 'network') {
            if (hasMediaRecorder && hasGetUserMedia) {
              startMediaRecorder()
            } else {
              setVoiceError(
                'Network error during voice recognition. Please check your connection or type instead.'
              )
            }
          } else if (event.error === 'aborted') {
            setVoiceError(null)
          } else {
            if (hasMediaRecorder && hasGetUserMedia) {
              startMediaRecorder()
            } else {
              setVoiceError('Voice recognition failed. Please try again or type instead.')
            }
          }
        }

        // Track manual stops so onend can decide whether to auto-restart.
        // Mobile browsers (Chrome/Safari) stop SpeechRecognition after a few
        // seconds of silence — auto-restart keeps the recording going until
        // the user explicitly stops it.
        const localManualStopRef = { current: false }
        ;(recognition as any)._manualStopRef = localManualStopRef

        recognition.onend = () => {
          if (!localManualStopRef.current && recognitionRef.current === recognition) {
            try {
              recognition.start()
              return // don't tear down — we're restarting
            } catch {
              // restart failed (e.g. already started) — fall through to teardown
            }
          }
          setIsRecording(false)
          isRecordingRef.current = false
          setInterimTranscript('')
          setVoiceMethod(null)
          recognitionRef.current = null
          finalTextRef.current = ''
          cleanupTimers()
        }

        recognition.start()
        return
      } catch (err) {
        console.error('Web Speech API failed:', err)
      }
    }

    // FALLBACK: MediaRecorder + ASR API
    await startMediaRecorder()
  }

  // ─── Stop recording (manual) ───────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      // Mark as manually stopped so onend doesn't auto-restart
      const msr = (recognitionRef.current as any)._manualStopRef
      if (msr) msr.current = true
      try {
        recognitionRef.current.stop()
      } catch {
        // Ignore errors from already-stopped recognition
      }
      recognitionRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // Ignore errors from already-stopped recorder
      }
    }
    cleanupStream()
    setIsRecording(false)
    isRecordingRef.current = false
    setInterimTranscript('')
    setVoiceMethod(null)
    cleanupTimers()
  }, [cleanupStream, cleanupTimers])

  // ─── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        const msr = (recognitionRef.current as any)._manualStopRef
        if (msr) msr.current = true
        try {
          recognitionRef.current.stop()
        } catch {
          // noop
        }
        recognitionRef.current = null
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop()
        } catch {
          // noop
        }
      }
      cleanupStream()
      cleanupTimers()
    }
  }, [cleanupStream, cleanupTimers])

  return {
    isRecording,
    recordingTime,
    interimTranscript,
    voiceError,
    isTranscribing,
    voiceMethod,
    startRecording,
    stopRecording,
    clearError,
  }
}

// ─── VoiceNoteButton component ──────────────────────────────────────────────
//
// A self-contained button + recording indicator that uses useVoiceNote
// internally. Drop it next to any textarea to add voice dictation.
//
// Layout:
//   - Compact mic button (top-right of its container)
//   - Recording indicator (red card) appears below when recording
//   - Transcribing indicator appears below when transcribing
//   - Error card with Retry/Dismiss appears when there's an error
//
// All colors are RED-ONLY (red-50/100/200/400/500/600/700).

export interface VoiceNoteButtonProps {
  /** Current value of the textarea (transcript is appended to this). */
  value: string
  /** Called with the new combined text (existing + transcript). */
  onChange: (next: string) => void
  /** Optional wrapper className. */
  className?: string
  /** Optional className for the mic button itself. */
  buttonClassName?: string
  /** Accessible label for the mic button. */
  label?: string
}

export function VoiceNoteButton({
  value,
  onChange,
  className,
  buttonClassName,
  label,
}: VoiceNoteButtonProps) {
  const voice = useVoiceNote({
    onTranscript: onChange,
    currentValue: value,
  })

  return (
    <div className={`flex flex-col items-end gap-1.5 ${className ?? ''}`}>
      {/* Mic button */}
      <button
        type="button"
        onClick={voice.isRecording ? voice.stopRecording : voice.startRecording}
        disabled={voice.isTranscribing}
        aria-label={
          voice.isRecording ? `Stop voice recording${label ? ` for ${label}` : ''}` : `Start voice recording${label ? ` for ${label}` : ''}`
        }
        aria-pressed={voice.isRecording}
        title={voice.isRecording ? 'Stop recording' : 'Dictate with voice'}
        className={`inline-flex items-center justify-center h-9 w-9 rounded-md transition-all min-h-[36px] min-w-[36px] ${
          voice.isRecording
            ? 'bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/30'
            : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
        } ${buttonClassName ?? ''}`}
      >
        {voice.isRecording ? (
          <Square className="h-3.5 w-3.5 fill-current" />
        ) : voice.isTranscribing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>

      {/* Recording indicator */}
      {voice.isRecording && (
        <div className="w-full max-w-[280px] p-2.5 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.6)] shrink-0" />
              <span className="text-[11px] text-red-600 font-semibold shrink-0">
                {voice.voiceMethod === 'web-speech' ? 'Listening' : 'Recording'}
              </span>
              <span className="text-[11px] text-red-500 font-mono tabular-nums shrink-0">
                {formatTime(voice.recordingTime)}
              </span>
            </div>
            <button
              type="button"
              onClick={voice.stopRecording}
              className="flex items-center gap-1 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1 rounded-md transition-colors min-h-[26px] shrink-0"
            >
              <Square className="h-2.5 w-2.5 fill-current" />
              Stop
            </button>
          </div>
          {voice.interimTranscript && (
            <p className="text-[11px] text-red-400/80 italic mt-1.5 line-clamp-2 break-words">
              {voice.interimTranscript}
            </p>
          )}
        </div>
      )}

      {/* Transcribing indicator */}
      {voice.isTranscribing && !voice.isRecording && (
        <div className="w-full max-w-[280px] flex items-center gap-1.5 px-2.5 py-2 bg-red-50 border border-red-200 rounded-lg">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-red-600 shrink-0" />
          <span className="text-[11px] text-red-700 font-medium">Transcribing your voice note...</span>
        </div>
      )}

      {/* Error with retry / dismiss */}
      {voice.voiceError && !voice.isRecording && !voice.isTranscribing && (
        <div className="w-full max-w-[280px] px-2.5 py-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-red-700 flex-1 leading-snug break-words">
            {voice.voiceError}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => voice.startRecording()}
              className="text-[10px] font-medium text-red-600 hover:text-red-700 px-1.5 py-1 bg-red-100 hover:bg-red-200 rounded transition-colors min-h-[24px]"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={voice.clearError}
              className="p-0.5 hover:bg-red-200 rounded transition-colors"
              aria-label="Dismiss voice error"
            >
              <X className="h-3 w-3 text-red-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
