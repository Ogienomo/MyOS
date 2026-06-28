'use client'
import { useState, useRef, useEffect, useLayoutEffect, useCallback, Component, ReactNode } from 'react'
import { useAppStore, ChatMessage } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Send, Sparkles, Loader2, MessageCircle, X, Mic, Square,
  Image as ImageIcon, AlertCircle, Sun, Target, Moon, MessageSquare, Lock,
  Trash2, Copy, Check, Brain,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// Coaching phrases for insistence dialog
const INSISTENCE_PHRASES = [
  "You're avoiding this for a reason. Fill it in. Now. No excuses.",
  "Every blank field is dishonesty with yourself. You're better than this. Fill it in.",
  "This is your accountability moment. Skipping is weakness. Discipline is built right here.",
  "I'm not letting you off the hook. Not today, not ever. Every answer matters.",
  "Skipping is how drift starts. And drift ends in regret. Fill it in, .",
  "You don't get to skip the hard parts. That's where the growth is. Answer the question.",
  "Avoiding this won't make it go away. Face it. Fill it in. That's an order, not a suggestion.",
]

const ESCALATION_MESSAGE = "This is the 3rd time you're trying to skip. Your goals deserve your honesty. Your excuses don't serve you. Fill it in NOW."
let insistencePhraseIndex = 0
function getNextInsistencePhrase(): string {
  const phrase = INSISTENCE_PHRASES[insistencePhraseIndex % INSISTENCE_PHRASES.length]
  insistencePhraseIndex++
  return phrase
}

const checkInTemplates = [
  {
    type: 'morning',
    label: 'Morning Alignment',
    time: '5:00 AM',
    timeShort: '5AM',
    fields: [
      { key: 'schedule', label: "Today's Schedule", placeholder: 'What does your day look like?' },
      { key: 'feeling', label: "How I'm Feeling", placeholder: 'How are you feeling right now?' },
      { key: 'priorities', label: 'Main Priorities', placeholder: 'What are the most important things today?' },
      { key: 'concerns', label: 'Concerns / Constraints', placeholder: 'Anything worrying you or limiting you today?' },
    ],
  },
  {
    type: 'midday',
    label: 'Midday Correction',
    time: '12:00 PM',
    timeShort: '12PM',
    fields: [
      { key: 'completed', label: 'Completed', placeholder: 'What have you done so far?' },
      { key: 'status', label: 'Current Status', placeholder: 'Where are you right now?' },
      { key: 'blockers', label: 'Blockers', placeholder: 'What is blocking progress?' },
      { key: 'slipping', label: 'What is slipping?', placeholder: 'What might not get done?' },
    ],
  },
  {
    type: 'evening',
    label: 'Evening Review',
    time: '8:30 PM',
    timeShort: '8PM',
    fields: [
      { key: 'goalsMet', label: 'Goals Met', placeholder: 'What goals did you achieve today?' },
      { key: 'goalsMissed', label: 'Goals Missed', placeholder: 'What goals did you miss?' },
      { key: 'moneyReceived', label: 'Money Received', placeholder: 'Any money received today?' },
      { key: 'moneySpent', label: 'Money Spent', placeholder: 'What did you spend money on?' },
      { key: 'havilahProgress', label: 'Havilah Progress', placeholder: 'Any progress on Havilah?' },
      { key: 'distractions', label: 'Distractions', placeholder: 'What distracted you?' },
      { key: 'lessons', label: 'Lessons Learned', placeholder: 'What did you learn?' },
    ],
  },
  {
    type: 'friday',
    label: 'Friday Strategic Review',
    time: '4:30 PM',
    timeShort: '4PM',
    fields: [
      { key: 'faith', label: 'Faith', placeholder: 'How was your spiritual life this week?' },
      { key: 'health', label: 'Health', placeholder: 'How was your health this week?' },
      { key: 'career', label: 'Career', placeholder: 'Career progress this week?' },
      { key: 'havilah', label: 'Havilah', placeholder: 'Havilah progress this week?' },
      { key: 'finances', label: 'Finances', placeholder: 'Financial summary this week?' },
      { key: 'relationships', label: 'Relationships', placeholder: 'How were your relationships?' },
      { key: 'personalGrowth', label: 'Personal Growth', placeholder: 'How did you grow this week?' },
      { key: 'biggestWins', label: 'Biggest Wins', placeholder: 'What were your biggest wins?' },
      { key: 'drift', label: 'Areas of Drift', placeholder: 'Where did you drift off course?' },
    ],
  },
  {
    type: 'sunday',
    label: 'Sunday Planning',
    time: '6:00 PM',
    timeShort: '6PM',
    fields: [
      { key: 'weekReview', label: 'Week Review', placeholder: 'Brief review of the past week' },
      { key: 'priorities', label: 'Next Week Priorities', placeholder: 'What are the priorities for next week?' },
      { key: 'deadlines', label: 'Deadlines', placeholder: 'Any upcoming deadlines?' },
      { key: 'focusBlocks', label: 'Focus Blocks', placeholder: 'When will you do deep work?' },
      { key: 'commitments', label: 'Important Commitments', placeholder: 'What commitments must you protect?' },
    ],
  },
]

// ─── AI Prompt Chips ────────────────────────────────────────────────────────
// Context-aware starter chips shown above the input. Rotate by time of day
// and alternate every render so the user always sees fresh suggestions.

function getPromptChips(hour: number): { label: string; message: string; icon: string }[] {
  const morning = [
    { label: 'Accountability check', message: "Hold me accountable today. Ask me what my 3 most important tasks are and make sure I commit to them.", icon: '🎯' },
    { label: 'Motivation boost', message: "I need a powerful motivational message to start my day strong. Be direct and challenging.", icon: '⚡' },
    { label: 'Mindset reset', message: "Give me a mindset reset. What should I be thinking about right now to make today exceptional?", icon: '🧠' },
    { label: 'Priority clarity', message: "Help me clarify my top priority for today and why it matters for my long-term goals.", icon: '🔥' },
  ]
  const midday = [
    { label: 'Am I on track?', message: "Give me a midday reality check. What should I have done by now and what needs to happen in the next 4 hours?", icon: '📊' },
    { label: 'Refocus me', message: "I feel distracted. Help me refocus and get back on track for the rest of the day.", icon: '🎯' },
    { label: 'Energy check', message: "My energy is low. What strategies should I use right now to push through and stay productive?", icon: '⚡' },
    { label: 'Course correction', message: "The morning didn't go as planned. Help me course-correct and make the afternoon count.", icon: '🔄' },
  ]
  const evening = [
    { label: 'Daily debrief', message: "Let's do a thorough debrief of my day. Ask me what I accomplished, what I missed, and what I learned.", icon: '📋' },
    { label: 'Win/Loss review', message: "Review my wins and losses for today honestly. Don't sugarcoat — I need truth to grow.", icon: '⚖️' },
    { label: 'Tomorrow prep', message: "Help me prepare for tomorrow. What should I prioritize and what mindset should I go in with?", icon: '🌅' },
    { label: 'Lesson extraction', message: "What lessons should I extract from today to make sure I improve tomorrow?", icon: '💡' },
  ]
  const universal = [
    { label: 'Faith check', message: "How is my faith life affecting my discipline and productivity? Give me a spiritual perspective.", icon: '✝️' },
    { label: 'Goals review', message: "Review my current goals with me. Which ones need more urgency and which ones am I neglecting?", icon: '🏆' },
    { label: 'Pattern alert', message: "Based on what you know about me, what negative pattern should I be aware of and break right now?", icon: '⚠️' },
  ]

  const catchMeUp = { label: 'Catch Me Up', message: "Give me a 3-bullet summary of my progress today across all life areas — Faith, Health, Career, Havilah, Finances, Relationships, and Personal Growth — based on everything I've logged today.", icon: '📊' }

  if (hour < 12) return [catchMeUp, ...morning, ...universal].slice(0, 5)
  if (hour < 17) return [catchMeUp, ...midday, ...universal].slice(0, 5)
  return [catchMeUp, ...evening, ...universal].slice(0, 5)
}

function getDefaultCheckInType(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 16) return 'midday'
  return 'evening'
}

function getCurrentExpectedCheckInType(): string {
  return getDefaultCheckInType()
}

// Custom timestamp formatter — avoids toLocaleTimeString inconsistencies on mobile browsers
// where the space between time and AM/PM may be a thin space, non-breaking space, or other Unicode whitespace
function formatTimestamp(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')}\u00A0${ampm}`
}

// Get time-of-day label for header
function getTimeContext(): string {
  const hour = new Date().getHours()
  const now = new Date()
  const timeStr = formatTimestamp(now)
  if (hour < 12) return `Morning \u2022 ${timeStr}`
  if (hour < 17) return `Afternoon \u2022 ${timeStr}`
  return `Evening \u2022 ${timeStr}`
}

function getContextualPrompt(): { message: string; suggestions: { type: string; label: string; desc: string; primary?: boolean }[] } {
  const hour = new Date().getHours()
  if (hour < 10) {
    return {
      message: "Good morning, . Let's start the day aligned. Have you done your Morning Alignment?",
      suggestions: [
        { type: 'morning', label: 'Morning Alignment', desc: 'Start your day right', primary: true },
        { type: 'quicklog', label: 'Quick Mood Log', desc: 'How are you feeling?' },
      ],
    }
  } else if (hour < 14) {
    return {
      message: "Midday check, . Are you on track? Let's do a quick correction.",
      suggestions: [
        { type: 'midday', label: 'Midday Correction', desc: 'Stay on course', primary: true },
        { type: 'chat', label: 'Talk to Coach', desc: "What's on your mind?" },
      ],
    }
  } else if (hour < 21) {
    return {
      message: "Evening review time, . How did the day go? Let's account for it.",
      suggestions: [
        { type: 'evening', label: 'Evening Review', desc: 'Review your day', primary: true },
        { type: 'chat', label: 'Talk to Coach', desc: 'Reflect on today' },
      ],
    }
  } else {
    return {
      message: "It's late, . Have you done your Evening Review? Don't skip accountability.",
      suggestions: [
        { type: 'evening', label: 'Evening Review', desc: "Don't skip this", primary: true },
        { type: 'chat', label: 'Talk to Coach', desc: 'Before you rest' },
      ],
    }
  }
}

function stripFootnotes(content: string): string {
  try {
    if (typeof content !== 'string' || !content) return ''
    let cleaned = content.replace(/\[\^\d+\](?::\s*.*)?/g, '')
    cleaned = cleaned.replace(/^\[\^\d+\]:\s*.*$/gm, '')
    cleaned = cleaned.replace(/^#{0,3}\s*(Footnotes|References|Notes)\s*$/gim, '---')
    cleaned = cleaned.replace(/\[↩\]/g, '')
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
    return cleaned.trim()
  } catch (err) {
    console.error('stripFootnotes error:', err)
    return typeof content === 'string' ? content : ''
  }
}

// Error boundary for markdown rendering — prevents a single malformed/partial
// message from crashing the entire Chat component (which would trigger the
// outer ErrorBoundary and show "Something went wrong" to the user).
class MarkdownErrorBoundary extends Component<
  { children: ReactNode; fallback: string },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: string }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }
  componentDidCatch(error: Error) {
    console.error('Markdown render error (caught by local boundary):', error)
  }
  render() {
    if (this.state.hasError) {
      return <p className="whitespace-pre-wrap text-sm leading-relaxed">{this.props.fallback}</p>
    }
    return this.props.children
  }
}

// Safe wrapper around ReactMarkdown — guards content (always a string), strips
// footnotes safely, and falls back to plain text if markdown parsing fails.
function SafeMarkdown({ content }: { content: string }) {
  const safeContent = String(content || '')
  const stripped = stripFootnotes(safeContent)
  // Only render markdown if there's actual content; empty strings can cause
  // react-markdown internals to produce unexpected node shapes.
  if (!stripped.trim()) return null
  return (
    <MarkdownErrorBoundary fallback={safeContent}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{stripped}</ReactMarkdown>
    </MarkdownErrorBoundary>
  )
}

const markdownComponents = {
  h2: ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-base font-medium text-neutral-800 mt-5 mb-3 border-l-3 border-red-400 pl-3">{children}</h2>
  ),
  h3: ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-sm font-medium text-neutral-700 mt-4 mb-2 flex items-center gap-1.5">
      <span className="text-red-400 text-[8px]">\u25C6</span> {children}
    </h3>
  ),
  p: ({ children }: { children: React.ReactNode }) => (
    <p className="mb-3 leading-relaxed text-neutral-700 dark:text-neutral-300 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children: React.ReactNode }) => (
    <ul className="mb-4 space-y-1.5 list-disc pl-5">{children}</ul>
  ),
  ol: ({ children }: { children: React.ReactNode }) => (
    <ol className="list-decimal pl-5 mb-4 space-y-1">{children}</ol>
  ),
  li: ({ children, ordered }: { children: React.ReactNode; ordered?: boolean }) => (
    <li className="leading-relaxed pl-1">{children}</li>
  ),
  strong: ({ children }: { children: React.ReactNode }) => (
    <strong className="font-semibold text-neutral-800 bg-neutral-100 px-1 rounded">{children}</strong>
  ),
  em: ({ children }: { children: React.ReactNode }) => (
    <em className="italic text-neutral-500">{children}</em>
  ),
  blockquote: ({ children }: { children: React.ReactNode }) => (
    <blockquote className="bg-neutral-50 border-l-3 border-neutral-300 pl-4 pr-3 py-3 my-4 rounded-r-lg italic text-neutral-600">{children}</blockquote>
  ),
  hr: () => <hr className="border-red-100 my-4" />,
  code: ({ children, className }: { children: React.ReactNode; className?: string }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <div className="bg-neutral-900 rounded-lg p-4 my-4 overflow-x-auto">
          <code className="text-sm text-red-400 font-mono">{children}</code>
        </div>
      )
    }
    return (
      <code className="bg-neutral-100 text-neutral-700 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
    )
  },
  pre: ({ children }: { children: React.ReactNode }) => (
    <div className="bg-neutral-900 rounded-lg p-4 my-4 overflow-x-auto">
      {children}
    </div>
  ),
  sup: ({ children }: { children: React.ReactNode }) => {
    const text = String(children)
    if (/^\d+$/.test(text) || text === '\u21A9') {
      return null
    }
    return <sup className="text-red-500 text-[10px]">{children}</sup>
  },
  a: ({ href, children }: { href?: string; children: React.ReactNode }) => {
    if (href?.startsWith('#') || href?.startsWith('^') || href?.includes('fn') || href?.includes('footnote')) {
      return null
    }
    return (
      <a href={href} className="text-red-600 underline hover:text-red-800" target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  },
  section: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => {
    const dataFootnotes = props['data-footnotes'] || (props.className as string)?.includes?.('footnotes')
    if (dataFootnotes) return null
    return <section {...props}>{children}</section>
  },
  div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => {
    const className = String(props.className || '')
    if (className.includes('footnotes')) return null
    return <div {...props}>{children}</div>
  },
  // Table support (requires remark-gfm) — the server generates markdown tables
  // for check-in responses. Without these custom components, react-markdown
  // renders bare HTML which can overflow on mobile.
  table: ({ children }: { children: React.ReactNode }) => (
    <div className="overflow-x-auto my-4 -mx-1">
      <table className="w-full text-xs border-collapse border border-neutral-200 dark:border-neutral-700 rounded-lg">{children}</table>
    </div>
  ),
  thead: ({ children }: { children: React.ReactNode }) => (
    <thead className="bg-neutral-50 dark:bg-neutral-800/50">{children}</thead>
  ),
  tbody: ({ children }: { children: React.ReactNode }) => (
    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">{children}</tbody>
  ),
  tr: ({ children }: { children: React.ReactNode }) => (
    <tr className="border-b border-neutral-100 dark:border-neutral-800 last:border-0">{children}</tr>
  ),
  th: ({ children }: { children: React.ReactNode }) => (
    <th className="text-left font-semibold text-neutral-700 dark:text-neutral-200 px-2.5 py-2 whitespace-nowrap">{children}</th>
  ),
  td: ({ children }: { children: React.ReactNode }) => (
    <td className="px-2.5 py-2 text-neutral-600 dark:text-neutral-300 align-top">{children}</td>
  ),
}

export function Chat() {
  const {
    chatMessages,
    chatLoading,
    addChatMessage,
    setChatMessages,
    setChatLoading,
    chatHistoryLoaded,
    setChatHistoryLoaded,
    activeCheckInType,
    setActiveCheckInType,
    setLastSyncTimestamp,
    highlightItemId,
    highlightItemType,
    clearHighlightItem,
    clearChat,
    userSettings,
  } = useAppStore()

  // ─── Highlight search navigation ────
  useEffect(() => {
    if (!highlightItemId || highlightItemType !== 'chat') return

    // Check if the message exists in current messages; if not, reload history
    const existsInMessages = chatMessages.some(m => m.id === highlightItemId)
    if (!existsInMessages && chatHistoryLoaded) {
      // Reload with a larger set to find the highlighted message
      const reloadForHighlight = async () => {
        try {
          const res = await fetch('/api/chat?limit=500')
          if (res.ok) {
            const data = await res.json()
            if (data.messages) {
              setChatMessages(data.messages)
            }
          }
        } catch (err) {
          console.error('Failed to reload chat history for highlight:', err)
        }
      }
      reloadForHighlight()
    }

    let attempts = 0
    const maxAttempts = 15 // 15 * 200ms = 3 seconds max
    const tryScroll = () => {
      const el = document.getElementById(`item-${highlightItemId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(clearHighlightItem, 3000)
      } else if (attempts < maxAttempts) {
        attempts++
        setTimeout(tryScroll, 200)
      } else {
        clearHighlightItem()
      }
    }

    tryScroll()
  }, [highlightItemId, highlightItemType, clearHighlightItem, chatMessages, chatHistoryLoaded, setChatMessages])

  const [message, setMessage] = useState('')
  const [checkInData, setCheckInData] = useState<Record<string, string>>({})
  const [checkInStep, setCheckInStep] = useState(0)
  const [showCheckInForm, setShowCheckInForm] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState(checkInTemplates[0])
  // Validation state
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({})
  const [showInsistenceMessage, setShowInsistenceMessage] = useState(false)
  const [showInsistenceDialog, setShowInsistenceDialog] = useState(false)
  const [showSkipCheckInDialog, setShowSkipCheckInDialog] = useState(false)
  const [insistenceAttemptCount, setInsistenceAttemptCount] = useState(0)
  const [currentInsistencePhrase, setCurrentInsistencePhrase] = useState(INSISTENCE_PHRASES[0])
  const [strictModeMessage, setStrictModeMessage] = useState<string | null>(null)
  const [strictBlockedType, setStrictBlockedType] = useState<string | null>(null)
  // Voice state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [voiceMethod, setVoiceMethod] = useState<'web-speech' | 'media-recorder' | null>(null)
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(20).fill(3))
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<any>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const waveformRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finalTextRef = useRef('')
  const processedFinalsRef = useRef<Set<string>>(new Set())  // dedupe final transcripts
  const lastProcessedIndexRef = useRef(-1)  // track highest result index processed
  const MAX_RECORDING_TIME = 600  // 10 minutes — user requested longer recordings
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // ─── Memory panel state ────
  const [showMemories, setShowMemories] = useState(false)
  const [memoriesList, setMemoriesList] = useState<Array<{ id: string; type: string; area: string; content: string; date: string; createdAt: string }>>([])
  const [memoriesLoaded, setMemoriesLoaded] = useState(false)
  const [memoriesCount, setMemoriesCount] = useState(0)

  // Fetch memory count on mount (lightweight)
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/insights?type=memories-count')
        if (res.ok) {
          const data = await res.json()
          setMemoriesCount(data.total ?? 0)
        }
      } catch { /* non-critical */ }
    }
    fetchCount()
  }, [])

  // Load full memories list on first panel open
  const loadMemories = useCallback(async () => {
    if (memoriesLoaded) return
    try {
      const res = await fetch('/api/insights?type=memories')
      if (res.ok) {
        const data = await res.json()
        setMemoriesList(data.memories ?? [])
        setMemoriesCount(data.memoriesTotal ?? data.memories?.length ?? 0)
        setMemoriesLoaded(true)
      }
    } catch { /* non-critical */ }
  }, [memoriesLoaded])

  const toggleMemories = useCallback(() => {
    if (!showMemories && !memoriesLoaded) {
      loadMemories()
    }
    setShowMemories(prev => !prev)
  }, [showMemories, memoriesLoaded, loadMemories])

  // ─── Paragraph-by-paragraph streaming reveal ────
  // Instead of a rapid word-by-word dump, the AI's response is revealed one
  // paragraph (block separated by `\n\n`) at a time. Each newly revealed
  // paragraph animates in (opacity 0→1, y 8→0) for a calm, deliberate,
  // sophisticated feel. A short pause (~500ms) between paragraphs lets each
  // section "land" before the next begins. When the stream finishes, any
  // remaining buffered paragraphs are revealed immediately.
  const streamingMessageIdRef = useRef<string | null>(null)
  const streamingTargetRef = useRef('')
  const streamingDoneRef = useRef(false)
  const revealedParagraphsCountRef = useRef(0)
  const paragraphRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // IMPORTANT: The render path must only read STATE, never refs. Refs don't
  // trigger re-renders, so reading them during render leads to stale UI and
  // (in React strict / concurrent mode) can cause hard-to-debug crashes.
  // `streamingMessageId` is the id of the message currently being streamed.
  // `streamedMessageIds` is the set of message ids that have EVER been
  // streamed — once a message enters this set it permanently uses the
  // animated paragraph layout so its markdown doesn't remount on updates.
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [streamedMessageIds, setStreamedMessageIds] = useState<Set<string>>(() => new Set())

  const scheduleNextParagraphReveal = useCallback((messageId: string) => {
    const target = streamingTargetRef.current
    const done = streamingDoneRef.current

    // No content yet — keep polling until the stream produces something.
    // (This also covers the "finishStreaming called before content arrived"
    // case, e.g. when we have to fetch a server-side fallback after an empty
    // stream.)
    if (!target) {
      paragraphRevealTimerRef.current = setTimeout(() => scheduleNextParagraphReveal(messageId), 120)
      return
    }

    const allParagraphs = target.split('\n\n')

    // Determine how many paragraphs are "available" to reveal.
    let availableParagraphs: number
    if (done) {
      // Stream finished — all paragraphs are complete. Filter out trailing
      // empty strings produced by a final `\n\n`.
      let count = allParagraphs.length
      while (count > 0 && allParagraphs[count - 1] === '') count--
      availableParagraphs = count
    } else {
      // Stream ongoing — the last split item may still be receiving tokens,
      // so hold it back until the next `\n\n` arrives.
      availableParagraphs = Math.max(0, allParagraphs.length - 1)
    }

    if (done) {
      // Stream finished — immediately reveal any remaining paragraphs so the
      // user sees the complete response without further delay.
      if (availableParagraphs > revealedParagraphsCountRef.current) {
        revealedParagraphsCountRef.current = availableParagraphs
        const revealedContent = allParagraphs.slice(0, availableParagraphs).join('\n\n')
        setChatMessages(prev => {
          const updated = [...prev]
          const idx = updated.findIndex(m => m.id === messageId)
          if (idx >= 0 && updated[idx].role === 'assistant') {
            updated[idx] = { ...updated[idx], content: revealedContent }
          }
          return updated
        })
      }
      // Finalize: clear timer + state. The animated paragraph layout remains
      // in place via `streamedMessageIds` state so we don't remount the markdown.
      paragraphRevealTimerRef.current = null
      streamingMessageIdRef.current = null
      setStreamingMessageId(null)
      return
    }

    // Stream ongoing — reveal at most one new paragraph per tick, with a
    // pause between paragraphs so each section "lands".
    if (revealedParagraphsCountRef.current < availableParagraphs) {
      revealedParagraphsCountRef.current++
      const revealedCount = revealedParagraphsCountRef.current
      const revealedContent = allParagraphs.slice(0, revealedCount).join('\n\n')
      setChatMessages(prev => {
        const updated = [...prev]
        const idx = updated.findIndex(m => m.id === messageId)
        if (idx >= 0 && updated[idx].role === 'assistant') {
          updated[idx] = { ...updated[idx], content: revealedContent }
        }
        return updated
      })
      // Brief pause so the newly revealed paragraph has room to breathe
      // before the next one arrives.
      paragraphRevealTimerRef.current = setTimeout(() => scheduleNextParagraphReveal(messageId), 500)
    } else {
      // No new paragraph available yet — short poll for more stream content.
      paragraphRevealTimerRef.current = setTimeout(() => scheduleNextParagraphReveal(messageId), 100)
    }
  }, [setChatMessages])

  const startTypewriter = useCallback((messageId: string) => {
    // If a previous reveal is still running, snap it to its final content so
    // the user sees the complete previous response before the new one starts.
    if (paragraphRevealTimerRef.current && streamingMessageIdRef.current) {
      const prevId = streamingMessageIdRef.current
      const prevTarget = streamingTargetRef.current
      if (prevTarget) {
        setChatMessages(prev => {
          const updated = [...prev]
          const idx = updated.findIndex(m => m.id === prevId)
          if (idx >= 0 && updated[idx].role === 'assistant') {
            updated[idx] = { ...updated[idx], content: prevTarget }
          }
          return updated
        })
      }
      clearTimeout(paragraphRevealTimerRef.current)
      paragraphRevealTimerRef.current = null
    }
    streamingMessageIdRef.current = messageId
    setStreamingMessageId(messageId)
    // Mark this message as "has been streamed" in STATE (not a ref) so the
    // render path can reliably switch it to the animated paragraph layout.
    // We create a NEW Set so React sees a new reference and re-renders.
    setStreamedMessageIds(prev => {
      if (prev.has(messageId)) return prev
      const next = new Set(prev)
      next.add(messageId)
      return next
    })
    streamingTargetRef.current = ''
    streamingDoneRef.current = false
    revealedParagraphsCountRef.current = 0
    // Kick off the scheduler — it will poll for content and reveal paragraphs
    // as they arrive from the stream.
    paragraphRevealTimerRef.current = setTimeout(() => scheduleNextParagraphReveal(messageId), 60)
  }, [setChatMessages, scheduleNextParagraphReveal])

  const updateStreamingTarget = useCallback((content: string) => {
    streamingTargetRef.current = String(content || '')
  }, [])

  const finishStreaming = useCallback(() => {
    // Mark the stream as done — the scheduler will immediately reveal any
    // remaining paragraphs on its next tick.
    streamingDoneRef.current = true
  }, [])

  const stopTypewriter = useCallback(() => {
    // Snap to final content immediately (used on error / unmount / new message).
    const messageId = streamingMessageIdRef.current
    const finalContent = streamingTargetRef.current
    if (messageId && finalContent) {
      setChatMessages(prev => {
        const updated = [...prev]
        const idx = updated.findIndex(m => m.id === messageId)
        if (idx >= 0 && updated[idx].role === 'assistant') {
          updated[idx] = { ...updated[idx], content: finalContent }
        }
        return updated
      })
    }
    if (paragraphRevealTimerRef.current) {
      clearTimeout(paragraphRevealTimerRef.current)
      paragraphRevealTimerRef.current = null
    }
    streamingMessageIdRef.current = null
    setStreamingMessageId(null)
    streamingTargetRef.current = ''
    revealedParagraphsCountRef.current = 0
    streamingDoneRef.current = false
  }, [setChatMessages])
  const isWithinCheckInWindow = useCallback((checkInType: string): { allowed: boolean; message: string | null } => {
    const settings = userSettings
    if (!settings) return { allowed: true, message: null }

    const { checkInWindows } = settings
    if (!checkInWindows.strictMode) return { allowed: true, message: null }
    if (!['morning', 'evening'].includes(checkInType)) return { allowed: true, message: null }
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    if (checkInType === 'morning') {
      if (!checkInWindows.morningEnabled) return { allowed: false, message: 'Morning check-in is disabled in your settings.' }
      const [h, m] = checkInWindows.morningTime.split(':').map(Number)
      const targetMinutes = h * 60 + m
      const windowMin = Math.max(0, targetMinutes - checkInWindows.windowMinutes)
      const windowMax = targetMinutes + checkInWindows.windowMinutes
      if (currentMinutes >= windowMin && currentMinutes <= windowMax) return { allowed: true, message: null }
      const nextH = Math.floor(windowMin / 60) % 24
      const nextM = windowMin % 60
      const nextTime = `${nextH.toString().padStart(2, '0')}:${nextM.toString().padStart(2, '0')}`
      return { allowed: false, message: `Check-in window is closed. Your next morning check-in opens at ${nextTime}. Strict mode is ON.` }
    }
    if (checkInType === 'evening') {
      if (!checkInWindows.eveningEnabled) return { allowed: false, message: 'Evening check-in is disabled in your settings.' }
      const [eh, em] = checkInWindows.eveningTime.split(':').map(Number)
      const eTarget = eh * 60 + em
      const eWinMin = Math.max(0, eTarget - checkInWindows.windowMinutes)
      const eWinMax = eTarget + checkInWindows.windowMinutes
      if (currentMinutes >= eWinMin && currentMinutes <= eWinMax) return { allowed: true, message: null }
      const eNextH = Math.floor(eWinMin / 60) % 24
      const eNextM = eWinMin % 60
      const eNextTime = `${eNextH.toString().padStart(2, '0')}:${eNextM.toString().padStart(2, '0')}`
      return { allowed: false, message: `Check-in window is closed. Your next evening check-in opens at ${eNextTime}. Strict mode is ON.` }
    }
    return { allowed: true, message: null }
  }, [userSettings])

  // ─── Open check-in form when navigated from dashboard ────
  // Uses useLayoutEffect so the form opens SYNCHRONOUSLY before paint,
  // preventing any flash of the general chat view. Also reads the raw store
  // value directly (in addition to the reactive hook value) to handle any
  // timing edge cases where the reactive value lags behind the store.
  useLayoutEffect(() => {
    // Read from both the reactive hook value AND the raw store to ensure
    // we never miss a check-in type set just before this component mounted.
    const type = activeCheckInType || useAppStore.getState().activeCheckInType
    if (type) {
      const template = checkInTemplates.find(t => t.type === type)
      if (template) {
        const { allowed, message } = isWithinCheckInWindow(type)
        if (!allowed) {
          setStrictModeMessage(message)
          setStrictBlockedType(type)
        } else {
          setStrictModeMessage(null)
          setStrictBlockedType(null)
          setActiveTemplate(template)
          setShowCheckInForm(true)
          setCheckInData({})
          setValidationErrors({})
          setShowInsistenceMessage(false)
        }
      }
      setActiveCheckInType(null)
    }
  }, [activeCheckInType, setActiveCheckInType, isWithinCheckInWindow])

  // Backup polling: if activeCheckInType was set just before mount and the
  // layout effect missed it, poll for 1s to catch it.
  useEffect(() => {
    if (activeCheckInType) return  // already handled by layout effect
    let cancelled = false
    const poll = setTimeout(() => {
      if (cancelled) return
      // Re-read from store in case it arrived late
      const current = useAppStore.getState().activeCheckInType
      if (current) {
        const template = checkInTemplates.find(t => t.type === current)
        if (template) {
          const { allowed, message } = isWithinCheckInWindow(current)
          if (allowed) {
            setActiveTemplate(template)
            setShowCheckInForm(true)
            setCheckInData({})
            setValidationErrors({})
          } else {
            setStrictModeMessage(message)
            setStrictBlockedType(current)
          }
        }
        setActiveCheckInType(null)
      }
    }, 200)
    return () => { cancelled = true; clearTimeout(poll) }
  }, [])

  // ─── Load chat history on mount ────
  useEffect(() => {
    if (chatHistoryLoaded) return
    const loadHistory = async () => {
      try {
        const res = await fetch('/api/chat?limit=500')
        if (res.ok) {
          const data = await res.json()
          if (data.messages && data.messages.length > 0) {
            setChatMessages(data.messages)
            // If we got exactly 500, there might be more
            setHasMoreMessages(data.messages.length >= 500)
          }
        }
      } catch (err) {
        console.error('Failed to load chat history:', err)
      } finally {
        setChatHistoryLoaded(true)
      }
    }
    loadHistory()
  }, [chatHistoryLoaded, setChatMessages, setChatHistoryLoaded])

  // ─── Load earlier messages ────
  const loadEarlierMessages = async () => {
    if (isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const res = await fetch('/api/chat?limit=1000')
      if (res.ok) {
        const data = await res.json()
        if (data.messages) {
          // Find messages not already loaded
          const existingIds = new Set(chatMessages.map(m => m.id))
          const newMessages = data.messages.filter((m: ChatMessage) => !existingIds.has(m.id))
          if (newMessages.length > 0) {
            // Prepend new messages
            setChatMessages([...newMessages, ...chatMessages])
          }
          setHasMoreMessages(data.messages.length >= 1000)
        }
      }
    } catch (err) {
      console.error('Failed to load earlier messages:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }

  // ─── Robust chat scroll-to-bottom ────
  // The chat can scroll on EITHER the shadcn ScrollArea viewport OR an
  // ancestor element (often <main>, whose overflow-y computes to "auto"
  // when overflow-x is hidden). To reliably land at the latest message we
  // scroll BOTH the viewport (if scrollable) and the nearest scrollable
  // ancestor. This guarantees the input bar stays visible.
  const scrollChatToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  // ─── Auto-scroll to bottom on mount ────
  // When the user navigates to the AI Coach tab, they should land at the
  // bottom (most recent message) — not the top. Multiple attempts handle
  // framer-motion enter animations and ScrollArea viewport mounting.
  useEffect(() => {
    const timers = [50, 200, 500, 900, 1500].map(delay => setTimeout(scrollChatToBottom, delay))
    return () => timers.forEach(clearTimeout)
  }, [scrollChatToBottom])  // mount only — ensures user lands at the latest message

  // ─── Auto-scroll on new messages ────
  useEffect(() => {
    const timer = setTimeout(scrollChatToBottom, 100)
    return () => clearTimeout(timer)
  }, [chatMessages, scrollChatToBottom])

  // ─── Prefill from drift alert "Ask Coach" shortcut ────
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent<{ message: string }>).detail?.message
      if (msg) setMessage(msg)
    }
    window.addEventListener('myos-prefill-chat', handler)
    return () => window.removeEventListener('myos-prefill-chat', handler)
  }, [])

  // Cleanup all voice recording resources on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (waveformRef.current) clearInterval(waveformRef.current)
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop())
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch { /* ignore */ }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop() } catch { /* ignore */ }
      }
      // Clear paragraph reveal timer to prevent memory leaks / stray state updates
      if (paragraphRevealTimerRef.current) {
        clearTimeout(paragraphRevealTimerRef.current)
        paragraphRevealTimerRef.current = null
      }
    }
  }, [])

  // ─── Voice Input (Web Speech API primary, MediaRecorder+ASR fallback) ───

  const startWaveformAnimation = useCallback(() => {
    setWaveformBars(Array(20).fill(3))
    waveformRef.current = setInterval(() => {
      setWaveformBars(prev => prev.map(() => Math.max(3, Math.random() * 24 + 4)))
    }, 120)
  }, [])

  const stopWaveformAnimation = useCallback(() => {
    if (waveformRef.current) {
      clearInterval(waveformRef.current)
      waveformRef.current = null
    }
    setWaveformBars(Array(20).fill(3))
  }, [])

  const cleanupTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current)
      recordingTimeoutRef.current = null
    }
    stopWaveformAnimation()
  }, [stopWaveformAnimation])

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [])

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

      const options = mimeType ? { mimeType } : undefined
      const mediaRecorder = new MediaRecorder(stream, options)
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
        setVoiceMethod(null)
        mediaRecorderRef.current = null
        setVoiceError('Recording failed. Your microphone may be in use by another app. Please try again or type your message.')
      }

      mediaRecorder.onstop = async () => {
        cleanupStream()

        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        if (recordingTime < 1) {
          setIsRecording(false)
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
          setVoiceError('Failed to process audio. Please try again or type your message instead.')
        }
        reader.readAsDataURL(blob)
      }

      mediaRecorder.start()
      setVoiceMethod('media-recorder')
      setIsRecording(true)
      setRecordingTime(0)
      setVoiceError(null)
      startWaveformAnimation()

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const next = prev + 1
          if (next >= MAX_RECORDING_TIME) {
            stopVoiceInput()
          }
          return next
        })
      }, 1000)

      recordingTimeoutRef.current = setTimeout(() => {
        if (isRecording) {
          stopVoiceInput()
        }
      }, (MAX_RECORDING_TIME + 1) * 1000)
    } catch (err: any) {
      console.error('Microphone access error:', err)
      cleanupStream()
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setVoiceError('Microphone access was denied. Please allow microphone access in your browser settings, or type your message instead.')
      } else if (err?.name === 'NotFoundError') {
        setVoiceError('No microphone found. Please connect a microphone or type your message instead.')
      } else if (err?.name === 'NotReadableError') {
        setVoiceError('Microphone is being used by another app. Please close other apps using the mic, or type your message instead.')
      } else {
        setVoiceError('Could not access microphone. Please check your browser settings or type your message instead.')
      }
    }
  }

  const startVoiceInput = async () => {
    setVoiceError(null)

    if (userSettings && !userSettings.voiceNotesEnabled) {
      setVoiceError('Voice notes are disabled in your settings. Enable them in Settings to use this feature.')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined'
    const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    if (!SpeechRecognition && (!hasMediaRecorder || !hasGetUserMedia)) {
      setVoiceError('Voice input is not supported in this browser. Please use Chrome or Edge for voice notes, or type your message instead.')
      return
    }

    // PRIMARY: Try Web Speech API first
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognitionRef.current = recognition
        setVoiceMethod('web-speech')
        setIsRecording(true)
        setRecordingTime(0)
        setVoiceError(null)
        startWaveformAnimation()

        // Reset the final text ref for new recording
        finalTextRef.current = ''
        processedFinalsRef.current = new Set()
        lastProcessedIndexRef.current = -1

        timerRef.current = setInterval(() => {
          setRecordingTime(prev => {
            const next = prev + 1
            if (next >= MAX_RECORDING_TIME) {
              stopVoiceInput()
            }
            return next
          })
        }, 1000)

        recordingTimeoutRef.current = setTimeout(() => {
          if (recognitionRef.current) {
            stopVoiceInput()
          }
        }, (MAX_RECORDING_TIME + 1) * 1000)

        // FIX: Voice transcription word duplication
        // Use ref to track accumulated final text + a Set to dedupe final
        // transcripts. Some browsers re-emit the same final result multiple
        // times (mobile Chrome especially), which caused duplicated words/phrases.
        // Normalization strips punctuation and collapses whitespace so that
        // minor formatting differences between re-emits don't bypass the check.
        recognition.onresult = (event: any) => {
          let interimText = ''
          let newFinalText = ''
          // Use max(resultIndex, lastProcessed+1) to guard against browsers
          // that re-send resultIndex=0 on every event (common on mobile Chrome).
          const startIdx = Math.max(event.resultIndex, lastProcessedIndexRef.current + 1)
          for (let i = startIdx; i < event.results.length; i++) {
            const result = event.results[i]
            const transcript = result[0].transcript
            if (result.isFinal) {
              // Mark this index as processed regardless of dedup
              lastProcessedIndexRef.current = Math.max(lastProcessedIndexRef.current, i)
              // Content-based dedup for browsers that repeat the same result
              const candidate = transcript.trim().toLowerCase()
                .replace(/[.,!?;:'"]/g, '')
                .replace(/\s+/g, ' ')
              if (candidate && !processedFinalsRef.current.has(candidate)) {
                processedFinalsRef.current.add(candidate)
                newFinalText += transcript + ' '
              }
            } else {
              interimText += transcript
            }
          }
          if (newFinalText.trim()) {
            finalTextRef.current += newFinalText
            setMessage(finalTextRef.current.trim())
          }
          setInterimTranscript(interimText)
        }

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error)
          cleanupTimers()
          setInterimTranscript('')
          setIsRecording(false)
          recognitionRef.current = null

          if (event.error === 'not-allowed') {
            if (hasMediaRecorder && hasGetUserMedia) {
              startMediaRecorder()
            } else {
              setVoiceError('Microphone access was denied. Please allow microphone access or type your message instead.')
            }
          } else if (event.error === 'no-speech') {
            setVoiceError('No speech was detected. Please try again in a quieter environment, or type your message instead.')
          } else if (event.error === 'network') {
            if (hasMediaRecorder && hasGetUserMedia) {
              startMediaRecorder()
            } else {
              setVoiceError('Network error during voice recognition. Please check your connection or type your message instead.')
            }
          } else if (event.error === 'aborted') {
            setVoiceError(null)
          } else {
            if (hasMediaRecorder && hasGetUserMedia) {
              startMediaRecorder()
            } else {
              setVoiceError('Voice recognition failed. Please try again or type your message instead.')
            }
          }
        }

        // Track whether the user manually stopped — if not, the browser
        // auto-stopped (common on mobile after a few seconds of silence) and
        // we should auto-restart to keep the recording going until the user
        // explicitly stops it.
        const manualStopRef = { current: false }
        ;(recognition as any)._manualStopRef = manualStopRef

        recognition.onend = () => {
          // If the user did NOT manually stop, auto-restart the recognition.
          // Browsers (especially mobile Chrome/Safari) stop SpeechRecognition
          // after a few seconds of silence — this keeps it alive.
          // A short 100ms delay before restart prevents "InvalidStateError"
          // when the previous recognition is still shutting down (common on desktop Chrome).
          if (!manualStopRef.current && recognitionRef.current === recognition) {
            setTimeout(() => {
              // Re-check that we're still in a live recording session (user might have
              // clicked stop in the 100ms window).
              if (!manualStopRef.current && recognitionRef.current === recognition) {
                try {
                  // Reset index tracking on each restart to avoid index confusion
                  lastProcessedIndexRef.current = -1
                  recognition.start()
                } catch {
                  // restart failed — tear down and stop recording
                  setIsRecording(false)
                  setInterimTranscript('')
                  setVoiceMethod(null)
                  recognitionRef.current = null
                  finalTextRef.current = ''
                  cleanupTimers()
                }
              }
            }, 100)
            return  // don't tear down — we're scheduling a restart
          }
          setIsRecording(false)
          setInterimTranscript('')
          setVoiceMethod(null)
          recognitionRef.current = null
          // Reset finalTextRef for next recording
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

  const stopVoiceInput = useCallback(() => {
    if (recognitionRef.current) {
      // Mark as manually stopped so onend doesn't auto-restart
      const manualStopRef = (recognitionRef.current as any)._manualStopRef
      if (manualStopRef) manualStopRef.current = true
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
    setInterimTranscript('')
    setVoiceMethod(null)
    cleanupTimers()
  }, [cleanupStream, cleanupTimers])

  const transcribeAudio = async (base64Audio: string) => {
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
        setMessage(prev => prev ? prev + ' ' + data.transcription : data.transcription)
        setVoiceError(null)
      } else {
        console.error('ASR transcription failed:', data.error)
        setVoiceError(data.error || 'Could not transcribe your voice. Please try again or type your message instead.')
      }
    } catch (err) {
      console.error('ASR transcription error:', err)
      setVoiceError('Voice transcription service is unavailable right now. Please type your message instead, or try again later.')
    } finally {
      setIsTranscribing(false)
    }
  }

  // Image upload function
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = async () => {
      const dataUrl = reader.result as string
      setImagePreview(dataUrl)
      setIsAnalyzing(true)

      try {
        const res = await fetch('/api/vlm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: dataUrl,
            prompt: message || 'Analyze this image in the context of my life goals and progress. What do you see?',
          }),
        })
        const data = await res.json()
        if (data.success && data.analysis) {
          const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: message || 'Shared an image',
            timestamp: new Date().toISOString(),
            hasImage: true,
          }
          addChatMessage(userMsg)

          const aiMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `**Image Analysis:**\n\n${data.analysis}`,
            timestamp: new Date().toISOString(),
          }
          addChatMessage(aiMsg)
        }
      } catch (err) {
        console.error('Image analysis error:', err)
      } finally {
        setIsAnalyzing(false)
        setImagePreview(null)
        setMessage('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    }
    reader.readAsDataURL(file)
  }

  // ─── Send Chat Message (mobile-resilient with retry) ────
  const sendChatMessage = async (content: string, isVoice: boolean = false, isSystemNudge: boolean = false, _retryCount: number = 0) => {
    if (!content.trim() || chatLoading) return

    // Snap any running typewriter to its final content before starting a new
    // message exchange — ensures the previous AI response is fully visible.
    stopTypewriter()

    try {
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: content.trim(),
        checkInType: (showCheckInForm || isSystemNudge) ? activeTemplate.type : undefined,
        timestamp: new Date().toISOString(),
        hasVoice: isVoice,
      }

      addChatMessage(userMsg)
      setChatLoading(true)
      setIsStreaming(true)
      setMessage('')
      if (!isSystemNudge) {
        setCheckInData({})
        setCheckInStep(0)
        setShowCheckInForm(false)
        setValidationErrors({})
        setShowInsistenceMessage(false)
        setInsistenceAttemptCount(0)
      }

      try {
        const history = chatMessages.slice(-30).map(m => ({ role: m.role, content: m.content }))
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content.trim(),
            checkInType: userMsg.checkInType,
            stream: true,
            history,
          }),
        })

        // Handle strict mode rejection from server (non-streaming error response)
        if (res.status === 403) {
          try {
            const data = await res.json()
            if (data.error === 'Check-in window closed') {
              setStrictModeMessage(data.message || 'Strict mode is enabled. Please check in during your scheduled window.')
              setChatLoading(false)
              setIsStreaming(false)
              return
            }
          } catch {
            // JSON parse failed for 403 — treat as generic error
          }
        }

        // Try streaming response
        if (res.ok && res.body) {
          // Guard: ensure ReadableStream and getReader are available (mobile Safari/Chrome safe)
          if (typeof ReadableStream === 'undefined' || typeof res.body.getReader !== 'function') {
            // Fallback: read as plain text
            try {
              const text = await res.text()
              if (text) {
                const aiMsg: ChatMessage = {
                  id: (Date.now() + 1).toString(),
                  role: 'assistant',
                  content: text,
                  checkInType: userMsg.checkInType,
                  timestamp: new Date().toISOString(),
                }
                addChatMessage(aiMsg)
              }
            } catch (textError) {
              console.error('Text fallback error (mobile-safe):', textError)
            }
          } else {
          const contentType = res.headers.get('content-type') || ''
          // If the server returns JSON instead of a stream (fallback)
          if (contentType.includes('application/json')) {
            try {
              const data = await res.json()
              if (data.response) {
                const aiMsg: ChatMessage = {
                  id: (Date.now() + 1).toString(),
                  role: 'assistant',
                  content: data.response,
                  checkInType: userMsg.checkInType,
                  timestamp: new Date().toISOString(),
                }
                addChatMessage(aiMsg)
              }
              if (data.syncResult) {
                const { goalsUpdated, tasksUpdated, financeEntriesCreated } = data.syncResult
                if (goalsUpdated > 0 || tasksUpdated > 0 || financeEntriesCreated > 0) {
                  setLastSyncTimestamp(Date.now())
                }
              }
              // Trigger dashboard refresh after check-in so streaks update
              if (userMsg.checkInType) {
                window.dispatchEvent(new CustomEvent('myos-refresh-dashboard'))
              }
            } catch (jsonError) {
              console.error('JSON parse error (mobile-safe):', jsonError)
              const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Failed to parse response. Please try again.',
                timestamp: new Date().toISOString(),
              }
              addChatMessage(errorMsg)
            }
          } else {
            // Stream the response with robust error handling for mobile
            let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
            try {
              reader = res.body.getReader()
              const decoder = new TextDecoder()
              let fullContent = ''

              // Create the AI message placeholder — always with a valid id and string content
              const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '',
                checkInType: userMsg.checkInType,
                timestamp: new Date().toISOString(),
              }
              addChatMessage(aiMsg)
              // Begin progressive typewriter reveal — content will appear word-by-word
              startTypewriter(aiMsg.id)

              while (true) {
                try {
                  const { done, value } = await reader.read()
                  if (done) break
                  let chunk = ''
                  try {
                    chunk = decoder.decode(value, { stream: true })
                  } catch (decodeError) {
                    console.warn('Chunk decode error (mobile-safe), skipping:', decodeError)
                    continue
                  }
                  fullContent += chunk
                  // Strip terminal signal from display content
                  const displayContent = fullContent.replace(/\x00\[DONE\]|\x00\[ERROR\]/g, '')
                  updateStreamingTarget(displayContent)
                } catch (chunkError) {
                  console.warn('Chunk read error (mobile-safe):', chunkError)
                  // On mobile, individual chunk reads can fail due to flaky connections
                  // Try to continue reading — if this is a fatal error the next read will also fail
                  // and we'll catch it at the outer level
                  break
                }
              }
              // Stream complete. Strip terminal signals before checking emptiness.
              const cleanedContent = fullContent.replace(/\x00\[DONE\]|\x00\[ERROR\]/g, '').trim()
              updateStreamingTarget(cleanedContent)
              if (!cleanedContent) {
                try {
                  const fallbackRes = await fetch('/api/chat?limit=5&latest=true')
                  if (fallbackRes.ok) {
                    const data = await fallbackRes.json()
                    const msgs: ChatMessage[] = data.messages || []
                    // Find the most recent assistant message (the server-side
                    // fallback that was saved during the empty stream).
                    const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant')
                    if (lastAssistant && lastAssistant.content) {
                      fullContent = lastAssistant.content
                      updateStreamingTarget(fullContent)
                    } else {
                      fullContent = '...'
                      updateStreamingTarget(fullContent)
                    }
                  } else {
                    fullContent = '...'
                    updateStreamingTarget(fullContent)
                  }
                } catch (fallbackErr) {
                  console.error('Failed to fetch fallback from DB (mobile-safe):', fallbackErr)
                  fullContent = '...'
                  updateStreamingTarget(fullContent)
                }
              }
              // Let the paragraph reveal scheduler finalize (immediately
              // reveals any remaining buffered paragraphs).
              finishStreaming()
              // Trigger dashboard refresh after check-in so streaks update
              if (userMsg.checkInType) {
                window.dispatchEvent(new CustomEvent('myos-refresh-dashboard'))
              }
            } catch (streamError) {
              console.error('Stream read error (mobile-safe):', streamError)
              // Snap typewriter to whatever was streamed so partial content is fully visible
              stopTypewriter()
              const hasPartialContent = fullContent.trim().length > 0
              // If partial content was streamed, keep it as the final response —
              // the user already sees something useful.
              if (!hasPartialContent) {
                // No content was streamed. The server still saved a fallback to
                // the DB, so prefer fetching that over showing an error.
                let fetchedFallback = false
                try {
                  const fallbackRes = await fetch('/api/chat?limit=5&latest=true')
                  if (fallbackRes.ok) {
                    const data = await fallbackRes.json()
                    const msgs: ChatMessage[] = data.messages || []
                    const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant')
                    if (lastAssistant && lastAssistant.content) {
                      setChatMessages(prev => {
                        const updated = [...prev]
                        for (let i = updated.length - 1; i >= 0; i--) {
                          if (updated[i].role === 'assistant' && !updated[i].content.trim()) {
                            updated[i] = { ...updated[i], content: lastAssistant.content }
                            break
                          }
                        }
                        return updated
                      })
                      fetchedFallback = true
                    }
                  }
                } catch (fallbackErr) {
                  console.error('Failed to fetch fallback from DB after stream error (mobile-safe):', fallbackErr)
                }
                // If we successfully fetched a fallback, do NOT retry or show
                // an error — the user has a real response now.
                if (!fetchedFallback) {
                  const canRetry = _retryCount < 2
                  if (canRetry) {
                    // Retry: remove the empty AI message + the user message, then re-send
                    setChatMessages(prev => {
                      const updated = [...prev]
                      if (updated[updated.length - 1]?.role === 'assistant' && !updated[updated.length - 1].content.trim()) {
                        updated.pop()
                      }
                      const lastUserMsg = updated[updated.length - 1]
                      if (lastUserMsg && lastUserMsg.role === 'user' && lastUserMsg.content === content.trim()) {
                        updated.pop()
                      }
                      return updated
                    })
                    setChatLoading(false)
                    setIsStreaming(false)
                    await new Promise(resolve => setTimeout(resolve, 1000 * (_retryCount + 1)))
                    return sendChatMessage(content, isVoice, isSystemNudge, _retryCount + 1)
                  }
                  // Retry limit reached — show a calm, non-error placeholder
                  // rather than a red error message. This will be replaced on
                  // the next interaction or refresh.
                  setChatMessages(prev => {
                    const updated = [...prev]
                    for (let i = updated.length - 1; i >= 0; i--) {
                      if (updated[i].role === 'assistant' && !updated[i].content.trim()) {
                        updated[i] = { ...updated[i], content: '...' }
                        break
                      }
                    }
                    return updated
                  })
                }
              }
            } finally {
              // Always release the reader lock to prevent "reader already released" errors on mobile
              if (reader) {
                try {
                  reader.releaseLock()
                } catch {
                  // Ignore — reader may already be released
                }
              }
            }
          }
          } // end ReadableStream check else block
        } else if (!res.ok) {
          // Non-403 error — try JSON parsing
          try {
            const data = await res.json()
            if (data.response) {
              const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.response,
                checkInType: userMsg.checkInType,
                timestamp: new Date().toISOString(),
              }
              addChatMessage(aiMsg)
            } else if (data.error) {
              const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Something went wrong: ${data.error}. Please try again.`,
                timestamp: new Date().toISOString(),
              }
              addChatMessage(errorMsg)
            }
          } catch {
            const errorMsg: ChatMessage = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: 'Network error. Please check your connection and try again.',
              timestamp: new Date().toISOString(),
            }
            addChatMessage(errorMsg)
          }
        }
      } catch (fetchError) {
        console.error('Fetch error (mobile-safe):', fetchError)
        const canRetry = _retryCount < 2
        if (canRetry) {
          // Remove the user message and retry
          setChatMessages(prev => {
            const updated = [...prev]
            const lastMsg = updated[updated.length - 1]
            if (lastMsg && lastMsg.role === 'user' && lastMsg.content === content.trim()) {
              updated.pop()
            }
            return updated
          })
          setChatLoading(false)
          setIsStreaming(false)
          await new Promise(resolve => setTimeout(resolve, 1000 * (_retryCount + 1)))
          return sendChatMessage(content, isVoice, isSystemNudge, _retryCount + 1)
        }
        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Connection error. Please check your internet and try again.',
          timestamp: new Date().toISOString(),
        }
        addChatMessage(errorMsg)
      }
    } catch (outerError) {
      // Catch-all: prevent any unhandled error from crashing the app
      console.error('Unexpected chat error (mobile-safe):', outerError)
      try {
        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          timestamp: new Date().toISOString(),
        }
        addChatMessage(errorMsg)
      } catch {
        // If even adding an error message fails, silently recover
      }
    } finally {
      setChatLoading(false)
      setIsStreaming(false)
    }
  }

  const handleFreeChat = () => {
    if (message.trim()) {
      sendChatMessage(message)
    }
  }

  const handleCheckInSubmit = () => {
    const { allowed, message: strictMsg } = isWithinCheckInWindow(activeTemplate.type)
    if (!allowed) {
      setStrictModeMessage(strictMsg)
      return
    }
    setStrictModeMessage(null)

    // ─── CHECK-IN INSISTENCE: Validate ALL required fields ───
    const errors: Record<string, boolean> = {}
    let hasEmptyField = false

    for (const field of activeTemplate.fields) {
      const value = (checkInData[field.key] || '').trim()
      if (!value) {
        errors[field.key] = true
        hasEmptyField = true
      }
    }

    if (hasEmptyField) {
      const newAttemptCount = insistenceAttemptCount + 1
      setInsistenceAttemptCount(newAttemptCount)
      setValidationErrors(errors)
      setShowInsistenceMessage(true)
      setShowInsistenceDialog(true)

      const nextPhrase = getNextInsistencePhrase()
      setCurrentInsistencePhrase(nextPhrase)

      setTimeout(() => {
        const firstErrorKey = Object.keys(errors)[0]
        const el = document.getElementById(`checkin-field-${firstErrorKey}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.classList.add('animate-shake')
          setTimeout(() => el.classList.remove('animate-shake'), 600)
          const textarea = el.querySelector('textarea')
          textarea?.focus()
        }
      }, 300)

      return
    }

    setValidationErrors({})
    setShowInsistenceMessage(false)
    setShowInsistenceDialog(false)
    setInsistenceAttemptCount(0)

    const template = activeTemplate
    let formattedMessage = `${template.label.toUpperCase()}\n\n`

    for (const field of template.fields) {
      const value = checkInData[field.key] || ''
      formattedMessage += `${field.label}: ${value}\n\n`
    }

    formattedMessage += '====================\n\nAfter completing this check-in, please respond with your structured output.'
    sendChatMessage(formattedMessage)
  }

  const hasValidationErrors = Object.values(validationErrors).some(v => v)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Only submit via Ctrl/Cmd+Enter. Plain Enter creates a newline (default
    // textarea behavior) so users can write multi-line messages without
    // accidentally sending. Shift+Enter also inserts a newline (default).
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleFreeChat()
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Handle Check-in button click with strict mode check
  const handleCheckInButtonClick = () => {
    const defaultType = getDefaultCheckInType()
    const template = checkInTemplates.find(t => t.type === defaultType)
    if (!template) return

    const { allowed, message: strictMsg } = isWithinCheckInWindow(defaultType)
    if (!allowed) {
      setStrictModeMessage(strictMsg)
      setStrictBlockedType(defaultType)
      return
    }

    setStrictModeMessage(null)
    setStrictBlockedType(null)
    setActiveTemplate(template)
    setCheckInData({})
    setCheckInStep(0)
    setValidationErrors({})
    setShowInsistenceMessage(false)
    setInsistenceAttemptCount(0)
    setShowCheckInForm(true)
  }

  // Handle suggestion click from contextual prompts
  const handleSuggestionClick = (type: string) => {
    if (type === 'chat') {
      textareaRef.current?.focus()
      return
    }

    if (type === 'quicklog') {
      setMessage('I want to log my mood, energy, and focus')
      return
    }

    const template = checkInTemplates.find(t => t.type === type)
    if (!template) return

    const { allowed, message: strictMsg } = isWithinCheckInWindow(type)
    if (!allowed) {
      setStrictModeMessage(strictMsg)
      setStrictBlockedType(type)
      return
    }

    setStrictModeMessage(null)
    setStrictBlockedType(null)
    setActiveTemplate(template)
    setCheckInData({})
    setCheckInStep(0)
    setValidationErrors({})
    setShowInsistenceMessage(false)
    setInsistenceAttemptCount(0)
    setShowCheckInForm(true)
  }

  // ─── Copy handlers ────
  const handleMessageTouchStart = (msgId: string, content: string) => {
    longPressTimerRef.current = setTimeout(() => {
      navigator.clipboard.writeText(content).catch(() => {
        // Clipboard API may fail in some contexts
      })
      setCopiedId(msgId)
      setTimeout(() => setCopiedId(null), 1500)
    }, 500)
  }

  const handleMessageTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleCopyClick = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content).catch(() => {})
    setCopiedId(msgId)
    setTimeout(() => setCopiedId(null), 1500)
  }

  // ─── New Chat ────
  const handleNewChat = async () => {
    // Clear the local state immediately for instant feedback
    clearChat()
    // Also clear server-side history so messages don't reappear on refresh
    try {
      await fetch('/api/chat', { method: 'DELETE' })
    } catch (err) {
      console.error('Failed to clear server chat history:', err)
    }
  }

  // Get the currently active time-based template type (client-only to avoid hydration mismatch)
  const currentDefaultType = mounted ? getDefaultCheckInType() : 'morning'

  const headerGradient = 'from-red-700 to-rose-600'

  return (
    <div className="flex flex-col h-full min-h-0" suppressHydrationWarning>
      {/* Chat Header — WhatsApp-style, sticky so nav is always visible */}
      <div className={`flex items-center justify-between px-4 py-2.5 bg-gradient-to-r ${headerGradient} shrink-0 sticky top-0 z-20`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center relative shrink-0">
            <Sparkles className="h-4.5 w-4.5 text-white" />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-red-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white leading-tight">MyOS AI Coach</h2>
            <p className="text-[10px] text-red-100/80 whitespace-nowrap" suppressHydrationWarning>
              {chatLoading ? 'typing...' : (mounted ? getTimeContext() : 'AI Coach')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!showCheckInForm && !showMemories && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-white/90 hover:text-white hover:bg-white/20 h-8 px-3"
              onClick={handleCheckInButtonClick}
            >
              <MessageCircle className="mr-1 h-3 w-3" />
              Check-in
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={`text-xs hover:text-white h-8 px-3 ${showMemories ? 'text-white bg-white/20' : 'text-white/90 hover:bg-white/20'}`}
            onClick={toggleMemories}
            title="What I Remember"
          >
            <Brain className="mr-1 h-3 w-3" />
            {memoriesCount > 0 ? `${memoriesCount} Memories` : 'Memories'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/20"
            onClick={handleNewChat}
            title="New Chat"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Strict Mode Blocked Message */}
      {strictModeMessage && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.5 }}
          className="border-b bg-rose-50"
        >
          <div className="px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-red-700 font-medium">{strictModeMessage}</p>
                {strictBlockedType && (
                  <p className="text-[10px] text-red-500 mt-1">
                    The {strictBlockedType} check-in is locked. Wait for the scheduled window or disable strict mode in Settings.
                  </p>
                )}
              </div>
              <button onClick={() => { setStrictModeMessage(null); setStrictBlockedType(null) }} className="p-0.5 hover:bg-red-100 rounded shrink-0">
                <X className="h-3.5 w-3.5 text-red-400" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Memory Panel — "What I Remember" */}
      <AnimatePresence>
        {showMemories && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="border-b bg-white dark:bg-neutral-900 overflow-hidden shadow-sm"
          >
            <div className="px-4 py-3">
              {/* Panel header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-red-600" />
                  <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">What I Remember</h3>
                  <span className="text-[10px] text-neutral-400 font-medium">{memoriesCount} total</span>
                </div>
                <button onClick={() => setShowMemories(false)} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded shrink-0">
                  <X className="h-3.5 w-3.5 text-neutral-400" />
                </button>
              </div>

              {/* Loading state */}
              {!memoriesLoaded && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                  <span className="ml-2 text-xs text-neutral-400">Loading memories…</span>
                </div>
              )}

              {/* Memories list */}
              {memoriesLoaded && memoriesList.length === 0 && (
                <p className="text-xs text-neutral-400 py-4 text-center">No memories stored yet. Keep chatting and checking in!</p>
              )}

              {memoriesLoaded && memoriesList.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 -mr-1">
                  {memoriesList.map((mem) => {
                    const typeColors: Record<string, string> = {
                      win: 'bg-green-100 text-green-700',
                      strength: 'bg-blue-100 text-blue-700',
                      weakness: 'bg-amber-100 text-amber-700',
                      distraction: 'bg-orange-100 text-orange-700',
                      correction: 'bg-red-100 text-red-700',
                      decision: 'bg-purple-100 text-purple-700',
                      pattern: 'bg-teal-100 text-teal-700',
                      event: 'bg-indigo-100 text-indigo-700',
                    }
                    const areaColors: Record<string, string> = {
                      faith: 'bg-violet-50 text-violet-600',
                      health: 'bg-emerald-50 text-emerald-600',
                      career: 'bg-sky-50 text-sky-600',
                      havilah: 'bg-amber-50 text-amber-600',
                      finances: 'bg-lime-50 text-lime-600',
                      relationships: 'bg-pink-50 text-pink-600',
                      personalGrowth: 'bg-cyan-50 text-cyan-600',
                    }
                    return (
                      <div
                        key={mem.id}
                        className="flex items-start gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${typeColors[mem.type] ?? 'bg-neutral-100 text-neutral-600'}`}>
                          {mem.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-snug line-clamp-2">{mem.content}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`inline-flex items-center px-1.5 py-0 rounded text-[10px] font-medium ${areaColors[mem.area] ?? 'bg-neutral-100 text-neutral-500'}`}>
                              {mem.area}
                            </span>
                            <span className="text-[10px] text-neutral-400">{mem.date}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Check-in Form — pinned card style */}
      <AnimatePresence>
        {showCheckInForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="border-b bg-white dark:bg-neutral-900 overflow-hidden shadow-sm"
          >
            <div className="flex items-start gap-2 px-3 py-2">
              <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                {checkInTemplates.map((template) => {
                  const { allowed } = isWithinCheckInWindow(template.type)
                  const isStrictBlocked = !allowed
                  const isTimeActive = template.type === currentDefaultType
                  return (
                    <button
                      key={template.type}
                      onClick={() => {
                        if (isStrictBlocked) {
                          const check = isWithinCheckInWindow(template.type)
                          setStrictModeMessage(check.message)
                          setStrictBlockedType(template.type)
                          return
                        }
                        setStrictModeMessage(null)
                        setStrictBlockedType(null)
                        setActiveTemplate(template)
                        setCheckInData({})
                        setCheckInStep(0)
                        setValidationErrors({})
                        setShowInsistenceMessage(false)
                        setInsistenceAttemptCount(0)
                      }}
                      disabled={isStrictBlocked}
                      className={`whitespace-nowrap text-[11px] px-3 py-2 rounded-full transition-all flex items-center gap-1.5 shrink-0 ${
                        activeTemplate.type === template.type
                          ? isStrictBlocked
                            ? 'bg-neutral-200 text-neutral-400 font-medium cursor-not-allowed opacity-50'
                            : isTimeActive
                              ? 'bg-neutral-900 text-white font-medium shadow-sm shadow-neutral-400/30'
                              : 'bg-neutral-900 text-white font-medium'
                          : isStrictBlocked
                            ? 'bg-neutral-100 text-neutral-300 border border-neutral-200 cursor-not-allowed opacity-40'
                            : isTimeActive
                              ? 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-300 ring-1 ring-neutral-200 shadow-sm'
                              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
                      }`}
                    >
                      {isStrictBlocked && <Lock className="h-3 w-3 shrink-0" />}
                      <span>{template.label}</span>
                      <span className={`text-[9px] whitespace-nowrap ${activeTemplate.type === template.type && !isStrictBlocked ? 'text-white/60' : 'text-neutral-400'}`}>
                        {template.timeShort}
                      </span>
                    </button>
                  )
                })}
              </div>
              <button onClick={() => {
                const expectedType = getCurrentExpectedCheckInType()
                const isExpectedTimeCheckIn = activeTemplate.type === expectedType
                const hasEmptyRequired = activeTemplate.fields.some(
                  field => !(checkInData[field.key] || '').trim()
                )
                if (isExpectedTimeCheckIn && hasEmptyRequired) {
                  setShowSkipCheckInDialog(true)
                } else {
                  setShowCheckInForm(false)
                  setStrictModeMessage(null)
                  setStrictBlockedType(null)
                  setValidationErrors({})
                  setShowInsistenceMessage(false)
                  setInsistenceAttemptCount(0)
                }
              }} className="p-1.5 hover:bg-neutral-200 rounded shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center">
                <X className="h-4 w-4 text-neutral-400" />
              </button>
            </div>

            {/* Stepper check-in — one question at a time */}
            {(() => {
              const fields = activeTemplate.fields
              const step = Math.min(checkInStep, fields.length - 1)
              const field = fields[step]
              const isLast = step === fields.length - 1
              const hasError = validationErrors[field.key]

              // Smart tag suggestions for each field
              const SMART_TAGS: Record<string, string[]> = {
                goalsMet: [
                  'Completed Morning Alignment', 'Completed Havilah task', 'Hit daily budget target',
                  'Bible reading done', 'Gym/workout done', 'Deep work block completed',
                  'Client follow-up done', 'No junk food today', 'Journaling done', 'All goals met',
                ],
                goalsMissed: [
                  'Missed budgeting review', 'Delayed Havilah execution', 'Skipped morning prayer',
                  'No gym today', 'Got distracted / anxious', 'Ran out of time',
                  'Skipped deep work', 'No Bible reading', 'Budget not reviewed', 'Missed client follow-up',
                ],
                moneyReceived: [
                  'Active business revenue', 'Salary / payout', 'Freelance payment',
                  'Personal / gift received', 'No income today',
                ],
                moneySpent: [
                  'Food & groceries', 'Transport', 'Business expense', 'Subscriptions',
                  'Personal care', 'Nothing spent today',
                ],
                havilahProgress: [
                  'Client outreach done', 'Content created', 'Revenue generated',
                  'Systems improved', 'Team coordination', 'No Havilah progress today',
                ],
                priorities: [
                  'Deep work block', 'Client emails', 'Havilah admin', 'Job application',
                  'Bible study', 'Gym', 'Journaling', 'Budget review',
                ],
                blockers: [
                  'Distraction', 'Low energy', 'Poor planning', 'Procrastination',
                  'Technical issue', 'Unclear priorities', 'Anxiety / overwhelm',
                ],
                distractions: [
                  'Social media', 'Phone scrolling', 'Unplanned visitors', 'Netflix / TV',
                  'Overthinking', 'Unnecessary calls', 'Emotional spiraling',
                ],
                lessons: [
                  'Need better time blocking', 'Mornings set the tone', 'Rest matters',
                  'Say no more often', 'Track spending daily', 'Start before feeling ready',
                ],
              }
              const tags = SMART_TAGS[field.key] || []

              return (
                <div className="px-3 sm:px-4 py-3">
                  {/* Progress dots */}
                  <div className="flex items-center justify-center gap-1.5 mb-4">
                    {fields.map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-full transition-all duration-300 ${
                          i === step ? 'w-5 h-2 bg-neutral-800' : i < step ? 'w-2 h-2 bg-neutral-400' : 'w-2 h-2 bg-neutral-200'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Step label */}
                  <p className="text-[10px] text-neutral-400 text-center mb-1">Step {step + 1} of {fields.length}</p>

                  {/* Animated field */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${activeTemplate.type}-${step}`}
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ duration: 0.2 }}
                    >
                      <label className={`text-sm font-semibold mb-2 block ${hasError ? 'text-red-600' : 'text-neutral-800'}`}>
                        {field.label}
                        {hasError && <span className="text-red-500 ml-1 text-xs font-normal">*required</span>}
                      </label>
                      <Textarea
                        key={`field-${field.key}`}
                        autoFocus
                        value={checkInData[field.key] || ''}
                        onChange={(e) => {
                          setCheckInData(prev => ({ ...prev, [field.key]: e.target.value }))
                          if (e.target.value.trim()) {
                            setValidationErrors(prev => {
                              const next = { ...prev }
                              delete next[field.key]
                              return next
                            })
                          }
                        }}
                        placeholder={field.placeholder}
                        className={`text-sm min-h-[80px] resize-none bg-white ${
                          hasError ? 'border-2 border-red-500 focus-visible:ring-red-500' : ''
                        }`}
                      />
                      {hasError && (
                        <p className="text-[10px] text-red-500 mt-1">This field is required. Don&apos;t skip it, .</p>
                      )}

                      {/* Smart tags — horizontal scroll row */}
                      {tags.length > 0 && (
                        <div className="flex gap-1.5 mt-2 overflow-x-auto overscroll-x-contain pb-1 scrollbar-hide -mx-1 px-1">
                          {tags.map(tag => {
                            const isSelected = (checkInData[field.key] || '').includes(tag)
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  const cur = checkInData[field.key] || ''
                                  if (cur.includes(tag)) {
                                    // deselect: remove the tag
                                    setCheckInData(prev => ({ ...prev, [field.key]: cur.replace(new RegExp(',?\\s*' + tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '').replace(/^,\s*/, '').trim() }))
                                  } else {
                                    const sep = cur.trim() ? ', ' : ''
                                    setCheckInData(prev => ({ ...prev, [field.key]: cur + sep + tag }))
                                  }
                                }}
                                className={`whitespace-nowrap shrink-0 text-[11px] px-3 py-1.5 rounded-full border transition-all ${
                                  isSelected
                                    ? 'bg-neutral-900 text-white border-neutral-900'
                                    : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300'
                                }`}
                              >
                                {isSelected ? tag : `+ ${tag}`}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {/* Navigation */}
                  <div className="flex items-center gap-2 mt-4">
                    {step > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setCheckInStep(s => s - 1)}
                      >
                        Back
                      </Button>
                    )}
                    {!isLast ? (
                      <Button
                        size="sm"
                        className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-white"
                        onClick={() => {
                          if (!(checkInData[field.key] || '').trim()) {
                            setValidationErrors(prev => ({ ...prev, [field.key]: true }))
                            return
                          }
                          setCheckInStep(s => s + 1)
                        }}
                      >
                        Next
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={handleCheckInSubmit}
                        disabled={chatLoading}
                        className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-white disabled:opacity-50"
                      >
                        {chatLoading ? (
                          <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Submitting...</>
                        ) : (
                          <><Send className="mr-1.5 h-3.5 w-3.5" />Submit Check-in</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages — native scroll div for reliable touch + desktop scrolling */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3" ref={scrollRef} style={{ background: 'var(--chat-bg, #fdf6f3)', WebkitOverflowScrolling: 'touch' }}>
        {chatMessages.length === 0 ? (
          showCheckInForm ? (
            /* Minimal hint when check-in form is active — no clutter */
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-neutral-400 text-center px-6">
                Fill in the form above and submit — your coach will respond here.
              </p>
            </div>
          ) : (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-rose-500 flex items-center justify-center mb-4 shadow-lg"
            >
              <Sparkles className="h-7 w-7 text-white" />
            </motion.div>
            <motion.h3
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="text-base font-bold text-neutral-800 dark:text-neutral-200 mb-1"
            >
              MyOS AI Coach
            </motion.h3>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xs mb-6 px-4"
            >
              {mounted ? getContextualPrompt().message : 'Your AI Coach is ready.'}
            </motion.p>
            <div className={`grid gap-2 w-full max-w-xs px-4 ${mounted && getContextualPrompt().suggestions.some(s => s.primary) ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {(mounted ? getContextualPrompt().suggestions : [{ type: 'chat', label: 'Start Chatting', desc: 'Talk to your coach' }, { type: 'morning', label: 'Morning Alignment', desc: 'Start your day right' }]).map((item, index) => (
                <motion.button
                  key={item.type}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index + 0.2, duration: 0.4 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleSuggestionClick(item.type)}
                  className={`flex flex-col items-start gap-0.5 px-4 py-3 rounded-2xl bg-white dark:bg-neutral-800 shadow-sm transition-all text-left active:shadow-none ${
                    item.primary
                      ? 'col-span-full border border-red-200 dark:border-red-800'
                      : 'border border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  <span className={`text-xs font-semibold ${item.primary ? 'text-red-700 dark:text-red-400' : 'text-neutral-800 dark:text-neutral-200'}`}>
                    {item.label}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{item.desc}</span>
                </motion.button>
              ))}
            </div>
          </div>
          )
        ) : (
          <div className="py-4 space-y-5">
            {/* Load earlier messages button */}
            {hasMoreMessages && (
              <div className="flex justify-center pb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-neutral-400 hover:text-neutral-600"
                  onClick={loadEarlierMessages}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load earlier messages'
                  )}
                </Button>
              </div>
            )}
            <AnimatePresence initial={false}>
              {(Array.isArray(chatMessages) ? chatMessages : []).map((msg) => (
                <motion.div
                  key={msg.id}
                  id={`item-${msg.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${highlightItemId === msg.id && highlightItemType === 'chat' ? 'ring-2 ring-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg' : ''}`}
                  onTouchStart={() => handleMessageTouchStart(msg.id, msg.content)}
                  onTouchEnd={handleMessageTouchEnd}
                  onTouchMove={handleMessageTouchEnd}
                >
                  <div
                    className={`max-w-[82%] sm:max-w-[72%] px-3.5 py-2.5 relative group ${
                      msg.role === 'user'
                        ? 'bg-red-600 text-white rounded-t-2xl rounded-l-2xl rounded-br-sm shadow-sm'
                        : 'bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-t-2xl rounded-r-2xl rounded-bl-sm shadow-sm'
                    }`}
                  >
                    {/* Copy button on hover (desktop) */}
                    <button
                      onClick={() => handleCopyClick(msg.id, msg.content)}
                      className={`absolute top-1.5 right-1.5 p-1 rounded-md transition-opacity ${
                        copiedId === msg.id
                          ? 'opacity-100 bg-red-100 dark:bg-red-900/30'
                          : 'opacity-0 group-hover:opacity-100 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                      }`}
                      title="Copy message"
                    >
                      {copiedId === msg.id ? (
                        <Check className="h-3 w-3 text-red-600 dark:text-red-400" />
                      ) : (
                        <Copy className="h-3 w-3 text-neutral-400" />
                      )}
                    </button>

                    {msg.checkInType && msg.role === 'user' && (
                      <Badge variant="secondary" className="mb-2 text-[10px] bg-white/20 text-white/80 border-white/20">
                        {msg.checkInType} check-in
                      </Badge>
                    )}
                    {msg.hasVoice && msg.role === 'user' && (
                      <Badge variant="secondary" className="mb-2 text-[10px] bg-white/20 text-white/80 border-white/20">
                        Voice Note
                      </Badge>
                    )}
                    {msg.hasImage && msg.role === 'user' && (
                      <Badge variant="secondary" className="mb-2 text-[10px] bg-white/20 text-white/80 border-white/20">
                        Image
                      </Badge>
                    )}
                    {msg.role === 'assistant' ? (
                      <div className="coach-response text-sm leading-relaxed">
                        {(() => {
                          // Defensive: guarantee content is a non-empty string
                          // before splitting. An undefined/null content (e.g.
                          // from a malformed DB row or a race condition during
                          // streaming) would otherwise throw on `.split` and
                          // crash the whole Chat via the outer ErrorBoundary.
                          const rawContent = msg.content
                          const content = typeof rawContent === 'string' && rawContent.length > 0
                            ? rawContent
                            : ''
                          const useAnimatedLayout =
                            streamingMessageId === msg.id || streamedMessageIds.has(msg.id)
                          // Only use the paragraph-by-paragraph animated layout
                          // when we actually have multi-paragraph content AND
                          // this message has been streamed. Empty or
                          // single-paragraph content goes through the plain
                          // SafeMarkdown path (which itself is guarded by a
                          // local MarkdownErrorBoundary).
                          if (!useAnimatedLayout || !content) {
                            return <SafeMarkdown content={content} />
                          }
                          const paragraphs = content.split('\n\n')
                          if (!paragraphs || paragraphs.length === 0) {
                            return <SafeMarkdown content={content} />
                          }
                          if (paragraphs.length === 1) {
                            // Single paragraph — no need for AnimatePresence.
                            return <SafeMarkdown content={paragraphs[0]} />
                          }
                          return (
                            <AnimatePresence initial={false}>
                              {paragraphs.map((para, i) => (
                                <motion.div
                                  key={`para-${i}`}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.6, ease: 'easeOut' }}
                                >
                                  <SafeMarkdown content={para} />
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          )
                        })()}
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{String(msg.content || '')}</p>
                    )}
                    <p className={`text-[10px] mt-1 whitespace-nowrap text-right ${msg.role === 'user' ? 'text-red-200/70' : 'text-neutral-400 dark:text-neutral-500'}`} suppressHydrationWarning>
                      {formatTimestamp(new Date(msg.timestamp))}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {(chatLoading || isTranscribing || isAnalyzing) && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex justify-start"
              >
                <div className="bg-white dark:bg-neutral-800 rounded-t-2xl rounded-r-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  {isTranscribing || isAnalyzing ? (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {isTranscribing ? 'Transcribing voice...' : 'Analyzing image...'}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1 py-0.5">
                      {[0, 0.2, 0.4].map((delay, i) => (
                        <motion.span
                          key={i}
                          className="w-2 h-2 bg-red-400 dark:bg-red-500 rounded-full block"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay, ease: 'easeInOut' }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className="border-t bg-neutral-50 dark:bg-neutral-900 p-2 flex items-center gap-2 shrink-0">
          <img src={imagePreview} alt="Upload preview" className="h-12 w-12 rounded-lg object-cover" />
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Analyzing image...</span>
          <Loader2 className="h-4 w-4 animate-spin text-red-600 dark:text-red-400" />
        </div>
      )}

      {/* Chat Input — WhatsApp style */}
      {!showCheckInForm && (
        <div className="bg-[#f0e8e3] dark:bg-neutral-900 p-2 pb-[5rem] md:pb-2 shrink-0 border-t border-neutral-200/50 dark:border-neutral-800">
          {/* Recording indicator with waveform */}
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl glow-red"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                  <span className="text-xs text-red-600 dark:text-red-400 font-semibold">
                    {voiceMethod === 'web-speech' ? 'Listening' : 'Recording'}
                  </span>
                  <span className="text-xs text-red-500 dark:text-red-400 font-mono tabular-nums">
                    {formatTime(recordingTime)}
                    {recordingTime >= MAX_RECORDING_TIME - 30 && <span className="text-red-700 dark:text-red-300 ml-1">/ {formatTime(MAX_RECORDING_TIME)}</span>}
                  </span>
                </div>
                <button
                  onClick={stopVoiceInput}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg transition-colors min-h-[36px]"
                >
                  <Square className="h-3 w-3 fill-current" />
                  {voiceMethod === 'web-speech' ? 'Stop' : 'Stop & Transcribe'}
                </button>
              </div>
              {/* Waveform visualization */}
              <div className="flex items-center justify-center gap-[2px] h-7 mt-2 px-2">
                {waveformBars.map((height, i) => (
                  <div
                    key={i}
                    className="w-[3px] rounded-full bg-gradient-to-t from-red-400 to-red-600 dark:from-red-500 dark:to-red-400 transition-all duration-100"
                    style={{ height: `${height}px` }}
                  />
                ))}
              </div>
              {/* Interim transcript for Web Speech API */}
              {interimTranscript && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 italic mt-1.5 truncate">{interimTranscript}</p>
              )}
            </motion.div>
          )}

          {/* Transcribing indicator */}
          {isTranscribing && (
            <div className="mb-2 flex items-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
              <Loader2 className="h-4 w-4 animate-spin text-red-600 dark:text-red-400" />
              <span className="text-xs text-red-700 dark:text-red-300 font-medium">Transcribing your voice note...</span>
            </div>
          )}

          {/* Voice error with retry/dismiss */}
          {voiceError && !isRecording && !isTranscribing && (
            <div className="mb-2 px-3 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-red-700 dark:text-red-300">{voiceError}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => { setVoiceError(null); startVoiceInput() }}
                  className="text-[11px] font-medium text-red-600 dark:text-red-400 hover:text-red-700 px-2.5 py-1.5 bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900 rounded-md transition-colors min-h-[32px]"
                >
                  Retry
                </button>
                <button
                  onClick={() => setVoiceError(null)}
                  className="p-1 hover:bg-red-200 dark:hover:bg-red-900 rounded"
                >
                  <X className="h-3.5 w-3.5 text-red-400" />
                </button>
              </div>
            </div>
          )}

          {/* Prompt chips — always visible above input, disappear when recording */}
          {!isRecording && !isTranscribing && (
            <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-2 scrollbar-hide -mx-0.5 px-0.5">
              {getPromptChips(mounted ? new Date().getHours() : 8).map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => {
                    setMessage(chip.message)
                    setTimeout(() => textareaRef.current?.focus(), 50)
                  }}
                  disabled={chatLoading}
                  className="flex items-center gap-1.5 whitespace-nowrap text-[11px] px-3 py-1.5 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-red-300 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0 shadow-sm disabled:opacity-40"
                >
                  <span>{chip.icon}</span>
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            {/* Voice Record Button */}
            {(!userSettings || userSettings.voiceNotesEnabled) && (
              <Button
                onClick={isRecording ? stopVoiceInput : startVoiceInput}
                disabled={isTranscribing || isAnalyzing}
                size="icon"
                className={`shrink-0 h-10 w-10 rounded-full transition-all ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30'
                    : 'bg-white dark:bg-neutral-800 hover:bg-red-50 dark:hover:bg-red-900/30 text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 shadow-sm'
                }`}
                aria-label={isRecording ? 'Stop recording' : 'Start voice recording'}
              >
                {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}

            {/* Image Upload Button */}
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing || isTranscribing}
              size="icon"
              className="shrink-0 h-10 w-10 rounded-full bg-white dark:bg-neutral-800 shadow-sm text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />

            {/* Text Input */}
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? `Listening... ${formatTime(recordingTime)}` : 'Message MyOS...'}
                className="text-sm min-h-[42px] max-h-[120px] resize-none bg-white dark:bg-neutral-800 dark:text-neutral-200 dark:placeholder-neutral-500 rounded-2xl border-0 shadow-sm px-4 py-2.5 focus-visible:ring-0"
                rows={1}
                disabled={isTranscribing || isAnalyzing}
              />
            </div>

            {/* Send Button */}
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                onClick={handleFreeChat}
                disabled={chatLoading || !message.trim() || isRecording || isTranscribing || isAnalyzing}
                size="icon"
                className="bg-red-600 hover:bg-red-700 text-white shrink-0 h-10 w-10 rounded-full shadow-sm disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        </div>
      )}

      {/* Insistence AlertDialog */}
      <AlertDialog open={showInsistenceDialog} onOpenChange={(open) => {
        if (!open) return
        setShowInsistenceDialog(open)
      }}>
        <AlertDialogContent className="border-red-300 bg-white" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              {insistenceAttemptCount >= 3
                ? ESCALATION_MESSAGE
                : "Praise, you're skipping required fields."
              }
            </AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-600 text-sm">
              {insistenceAttemptCount >= 3
                ? `${currentInsistencePhrase} This is attempt #${insistenceAttemptCount}. Your discipline is being tested right now. Don't fail yourself.`
                : currentInsistencePhrase
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          {insistenceAttemptCount >= 3 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-700 font-semibold">
                Attempt #{insistenceAttemptCount} — The discomfort you feel is resistance. That means you NEED to fill this in. Stop running. Face it.
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                setShowInsistenceDialog(false)
                setTimeout(() => {
                  const firstErrorKey = Object.keys(validationErrors)[0]
                  const el = document.getElementById(`checkin-field-${firstErrorKey}`)
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    el.classList.add('animate-shake')
                    setTimeout(() => el.classList.remove('animate-shake'), 600)
                    const textarea = el.querySelector('textarea')
                    textarea?.focus()
                  }
                }, 100)
              }}
            >
              {insistenceAttemptCount >= 3 ? "I Won't Skip This" : "I'll Fill It In"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Skip Check-in AlertDialog */}
      <AlertDialog open={showSkipCheckInDialog} onOpenChange={(open) => {
        if (!open) return
        setShowSkipCheckInDialog(open)
      }}>
        <AlertDialogContent className="border-rose-300 bg-white" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-700 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-600" />
              Are you sure you want to skip your check-in?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-600 text-sm">
              Discipline is built in these moments. Your {activeTemplate.label} check-in is waiting. Every time you skip, you weaken the habit. Stay committed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2">
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                setShowSkipCheckInDialog(false)
                setTimeout(() => {
                  const firstEmptyField = activeTemplate.fields.find(
                    f => !(checkInData[f.key] || '').trim()
                  )
                  if (firstEmptyField) {
                    const el = document.getElementById(`checkin-field-${firstEmptyField.key}`)
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      el.classList.add('animate-shake')
                      setTimeout(() => el.classList.remove('animate-shake'), 600)
                      const textarea = el.querySelector('textarea')
                      textarea?.focus()
                    }
                  }
                }, 100)
              }}
            >
              I'll Complete It
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
              onClick={() => {
                setShowSkipCheckInDialog(false)
                // Schedule a browser notification reminder in 30 minutes
                if ('Notification' in window && Notification.permission === 'granted') {
                  setTimeout(() => {
                    new Notification('MyOS — Check-in Reminder', {
                      body: `Your ${activeTemplate?.label || 'check-in'} is still waiting. Don't drift.`,
                      icon: '/icon-192.png',
                    })
                  }, 30 * 60 * 1000)
                }
              }}
            >
              Remind me in 30 min
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 border border-neutral-200"
              onClick={() => {
                setShowSkipCheckInDialog(false)
                setShowCheckInForm(false)
                setStrictModeMessage(null)
                setStrictBlockedType(null)
                setValidationErrors({})
                setShowInsistenceMessage(false)
                setInsistenceAttemptCount(0)
                const skipNudge = `Praise tried to skip her ${activeTemplate.type} check-in. Call her to order. Remind her why discipline matters and why skipping is how drift begins.`
                sendChatMessage(skipNudge, false, true)
              }}
            >
              Skip Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
