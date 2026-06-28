import { NextRequest, NextResponse } from 'next/server'

// DeepSeek-V3 (deepseek-chat) responds in 2–8s. The previous default
// (deepseek-reasoner / R1) took 30–120s and caused client-side timeouts that
// broke memory persistence. We keep maxDuration high as a safety margin for
// very long context windows, but normal chats now finish well under 10s.
export const maxDuration = 300

import { db } from '@/lib/db'
import { callZAIWithRetry, getOpenAIClient, MYOS_SYSTEM_PROMPT, formatTodaysDate } from '@/lib/ai'
import { getTodayInTimezone, formatDateInTimezone, getCurrentHourInTimezone, getCurrentTimeStringInTimezone, getCurrentMinutesInTimezone } from '@/lib/utils'
import { ChatMessageSchema, sanitizeForAI } from '@/lib/validation'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { recalcStreaks } from '@/lib/streaks'
import OpenAI from 'openai'

interface ChatRequestBody {
  message: string
  checkInType?: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  stream?: boolean
}

interface LifeContext {
  recentCheckIns: Array<{ type: string; date: string; data: string }>
  recentScores: Array<{ date: string; faith: number; health: number; career: number; havilah: number; finances: number; relationships: number; personalGrowth: number; overall: number }>
  activeGoals: Array<{ id: string; area: string; title: string; status: string; tasks: Array<{ id: string; title: string; status: string }> }>
  activeAlerts: Array<{ id: string; area: string; severity: string; message: string }>
  recentMemories: Array<{ type: string; area: string; content: string; date: string }>
  recentMoodLogs: Array<{ date: string; time: string; mood: number; energy: number; focus: number; note: string | null }>
  recentFinances: Array<{ date: string; type: string; amount: number; category: string; purpose: string | null; notes: string | null }>
  weekFinances: { received: number; spent: number; net: number; count: number }
  lifeAreaProgress: Array<{ area: string; currentStatus: string | null; idealVision: string | null; blockers: string | null }>
  today: string
}

async function buildContext(): Promise<LifeContext> {
  const today = formatTodaysDate()

  const [
    recentCheckIns,
    recentScores,
    activeGoals,
    activeAlerts,
    recentMemories,
    recentMoodLogs,
    recentFinances,
    weekFinances,
    lifeAreaProgress,
  ] = await Promise.all([
    db.checkIn.findMany({ orderBy: { createdAt: 'desc' }, take: 14 }),
    db.lifeAreaScore.findMany({ orderBy: { date: 'desc' }, take: 5 }),
    db.goal.findMany({ where: { status: 'In Progress' }, include: { tasks: true }, take: 7 }),
    db.driftAlert.findMany({ where: { resolved: false }, orderBy: { createdAt: 'desc' }, take: 5 }),
    db.memory.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    db.quickLog.findMany({ orderBy: { createdAt: 'desc' }, take: 14 }),
    db.financeEntry.findMany({ orderBy: { createdAt: 'desc' }, take: 14 }),
    (async () => {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const weekAgoStr = formatDateInTimezone(weekAgo)
      const entries = await db.financeEntry.findMany({ where: { date: { gte: weekAgoStr } } })
      return {
        received: entries.filter(f => f.type === 'received').reduce((s, f) => s + f.amount, 0),
        spent: entries.filter(f => f.type === 'spent').reduce((s, f) => s + f.amount, 0),
        net: entries.filter(f => f.type === 'received').reduce((s, f) => s + f.amount, 0) - entries.filter(f => f.type === 'spent').reduce((s, f) => s + f.amount, 0),
        count: entries.length,
      }
    })(),
    db.lifeAreaProgress.findMany({ orderBy: { area: 'asc' } }),
  ])

  return {
    recentCheckIns: recentCheckIns.map(ci => ({ type: ci.type, date: ci.date, data: ci.data })),
    recentScores: recentScores.map(s => ({ date: s.date, faith: s.faith, health: s.health, career: s.career, havilah: s.havilah, finances: s.finances, relationships: s.relationships, personalGrowth: s.personalGrowth, overall: s.overall })),
    activeGoals: activeGoals.map(g => ({ id: g.id, area: g.area, title: g.title, status: g.status, tasks: g.tasks.map(t => ({ id: t.id, title: t.title, status: t.status })) })),
    activeAlerts: activeAlerts.map(a => ({ id: a.id, area: a.area, severity: a.severity, message: a.message })),
    recentMemories: recentMemories.map(m => ({ type: m.type, area: m.area, content: m.content, date: m.date })),
    recentMoodLogs: recentMoodLogs.map(l => ({ date: l.date, time: l.time, mood: l.mood, energy: l.energy, focus: l.focus, note: l.note })),
    recentFinances: recentFinances.map(f => ({ date: f.date, type: f.type, amount: f.amount, category: f.category, purpose: f.purpose, notes: f.notes })),
    weekFinances,
    lifeAreaProgress: lifeAreaProgress.map(lap => ({ area: lap.area, currentStatus: lap.currentStatus, idealVision: lap.idealVision, blockers: lap.blockers })),
    today,
  }
}

function formatContextForAI(ctx: LifeContext): string {
  const parts: string[] = []

  if (ctx.recentCheckIns.length > 0) {
    parts.push('--- RECENT CHECK-INS ---')
    for (const ci of ctx.recentCheckIns) {
      parts.push(`[${ci.type}] ${ci.date}: ${ci.data.substring(0, 300)}`)
    }
  }
  if (ctx.recentScores.length > 0) {
    parts.push('--- RECENT LIFE SCORES ---')
    for (const s of ctx.recentScores) {
      parts.push(`${s.date}: Faith=${s.faith} Health=${s.health} Career=${s.career} Havilah=${s.havilah} Finances=${s.finances} Relationships=${s.relationships} PersonalGrowth=${s.personalGrowth} Overall=${s.overall}`)
    }
  }
  if (ctx.activeGoals.length > 0) {
    parts.push('--- ACTIVE GOALS ---')
    for (const g of ctx.activeGoals) {
      const completedTasks = g.tasks.filter(t => t.status === 'Completed').length
      parts.push(`[${g.area}] ${g.title} (${completedTasks}/${g.tasks.length} tasks done)`)
    }
  }
  if (ctx.activeAlerts.length > 0) {
    parts.push('--- ACTIVE DRIFT ALERTS ---')
    for (const a of ctx.activeAlerts) {
      parts.push(`[${a.severity}] ${a.area}: ${a.message}`)
    }
  }
  if (ctx.recentMemories.length > 0) {
    parts.push('--- RECENT MEMORIES ---')
    for (const m of ctx.recentMemories) {
      parts.push(`[${m.type}] ${m.area}: ${m.content}`)
    }
  }
  if (ctx.recentMoodLogs.length > 0) {
    parts.push('--- RECENT MOOD LOGS ---')
    for (const l of ctx.recentMoodLogs) {
      parts.push(`${l.date} ${l.time}: mood=${l.mood} energy=${l.energy} focus=${l.focus}${l.note ? ` "${l.note}"` : ''}`)
    }
  }
  if (ctx.recentFinances.length > 0) {
    parts.push('--- RECENT FINANCE ENTRIES ---')
    for (const f of ctx.recentFinances) {
      parts.push(`${f.date}: ${f.type} ₦${f.amount} (${f.category})${f.purpose ? ` — ${f.purpose}` : ''}`)
    }
  }
  if (ctx.weekFinances.count > 0) {
    parts.push('--- THIS WEEK FINANCES ---')
    parts.push(`Received: ₦${ctx.weekFinances.received.toLocaleString()} | Spent: ₦${ctx.weekFinances.spent.toLocaleString()} | Net: ₦${ctx.weekFinances.net.toLocaleString()}`)
  }
  if (ctx.lifeAreaProgress.length > 0) {
    parts.push('--- LIFE AREA PROGRESS ---')
    for (const lap of ctx.lifeAreaProgress) {
      parts.push(`[${lap.area}] Current: ${lap.currentStatus || 'Not set'} | Vision: ${lap.idealVision || 'Not set'}${lap.blockers ? ` | Blockers: ${lap.blockers}` : ''}`)
    }
  }
  parts.push(`--- CURRENT DATE: ${ctx.today} ---`)
  // Include the current time + time-of-day label so the AI is always
  // time-aware. Without this, the AI gives generic advice that doesn't match
  // the time (e.g. "execute today's plan" at 11:50 PM).
  // IMPORTANT: Use timezone-aware functions — `new Date().getHours()` returns
  // server-local time (UTC in production), which is off by 1 hour from the
  // user's timezone (Africa/Lagos, UTC+1).
  const hours = getCurrentHourInTimezone()
  const timeStr = getCurrentTimeStringInTimezone()
  let timeLabel: string
  if (hours < 10) timeLabel = 'MORNING (Morning Alignment window — start the day)'
  else if (hours < 14) timeLabel = 'MIDDAY (Midday Correction window — course-correct)'
  else if (hours < 17) timeLabel = 'AFTERNOON (execution time — push through)'
  else if (hours < 21) timeLabel = 'EVENING (Evening Review window — account for the day)'
  else if (hours < 23) timeLabel = 'LATE EVENING (reflect + prepare for tomorrow — do NOT say "execute today\'s plan")'
  else timeLabel = 'NIGHT (Praise should be resting — focus on tomorrow, NOT today. Do NOT say "execute today\'s plan")'
  parts.push(`--- CURRENT TIME: ${timeStr} (Africa/Lagos) ---`)
  parts.push(`--- TIME-OF-DAY: ${timeLabel} ---`)

  return parts.join('\n')
}

// Server-side strict mode check
function isWithinCheckInWindowServer(checkInType: string, settings: { strictMode: boolean; morningEnabled: boolean; morningTime: string; eveningEnabled: boolean; eveningTime: string; windowMinutes: number }): { allowed: boolean; message: string | null } {
  if (!settings.strictMode) return { allowed: true, message: null }
  if (!['morning', 'evening'].includes(checkInType)) return { allowed: true, message: null }

  // Use timezone-aware current minutes — server-local time (UTC in prod)
  // would misalign check-in windows by the timezone offset.
  const currentMinutes = getCurrentMinutesInTimezone()

  if (checkInType === 'morning') {
    if (!settings.morningEnabled) return { allowed: false, message: 'Morning check-in is disabled in your settings.' }
    const [h, m] = settings.morningTime.split(':').map(Number)
    const targetMinutes = h * 60 + m
    const windowMin = Math.max(0, targetMinutes - settings.windowMinutes)
    const windowMax = targetMinutes + settings.windowMinutes
    if (currentMinutes >= windowMin && currentMinutes <= windowMax) return { allowed: true, message: null }
    const nextH = Math.floor(windowMin / 60) % 24
    const nextM = windowMin % 60
    return { allowed: false, message: `Check-in window is closed. Your next morning check-in opens at ${nextH.toString().padStart(2, '0')}:${nextM.toString().padStart(2, '0')}. Strict mode is ON.` }
  }

  if (checkInType === 'evening') {
    if (!settings.eveningEnabled) return { allowed: false, message: 'Evening check-in is disabled in your settings.' }
    const [h, m] = settings.eveningTime.split(':').map(Number)
    const targetMinutes = h * 60 + m
    const windowMin = Math.max(0, targetMinutes - settings.windowMinutes)
    const windowMax = targetMinutes + settings.windowMinutes
    if (currentMinutes >= windowMin && currentMinutes <= windowMax) return { allowed: true, message: null }
    const nextH = Math.floor(windowMin / 60) % 24
    const nextM = windowMin % 60
    return { allowed: false, message: `Check-in window is closed. Your next evening check-in opens at ${nextH.toString().padStart(2, '0')}:${nextM.toString().padStart(2, '0')}. Strict mode is ON.` }
  }

  return { allowed: true, message: null }
}

// ============================================================
// INTELLIGENT COACHING ENGINE
// Generates rich, contextual, personalized responses from data
// ============================================================

const AREA_LABELS: Record<string, string> = {
  faith: 'Faith & Spiritual Life',
  health: 'Health & Wellness',
  career: 'Career & Professional Growth',
  havilah: 'Havilah & Entrepreneurship',
  finances: 'Finances & Stewardship',
  relationships: 'Relationships & Community',
  personalGrowth: 'Personal Growth & Learning',
}

function analyzeScores(ctx: LifeContext): { lowest: string[]; highest: string[]; trend: string; analysis: string } {
  if (ctx.recentScores.length === 0) {
    return { lowest: [], highest: [], trend: 'no_data', analysis: 'No scores recorded yet. Start by scoring your life areas to get personalized insights.' }
  }

  const latest = ctx.recentScores[0]
  const areas = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth'] as const
  const scored = areas.map(a => ({ area: a, score: latest[a] as number }))

  const sorted = [...scored].sort((a, b) => a.score - b.score)
  const lowest = sorted.filter(s => s.score <= 3).map(s => s.area)
  const highest = sorted.filter(s => s.score >= 7).map(s => s.area)

  let trend = 'stable'
  if (ctx.recentScores.length >= 2) {
    const prev = ctx.recentScores[ctx.recentScores.length - 1]
    const diff = latest.overall - prev.overall
    if (diff > 1) trend = 'improving'
    else if (diff < -1) trend = 'declining'
  }

  const analysis = lowest.length > 0
    ? `Your weakest areas right now: **${lowest.map(a => AREA_LABELS[a]).join(', ')}**. These need urgent attention.`
    : highest.length > 0
    ? `You are strongest in: **${highest.map(a => AREA_LABELS[a]).join(', ')}**. Keep building on this momentum.`
    : 'Your scores are moderate across the board. Time to push for excellence.'

  return { lowest, highest, trend, analysis }
}

function analyzeFinances(ctx: LifeContext): string {
  if (ctx.weekFinances.count === 0) {
    return 'No financial data this week. Track every naira to stay accountable.'
  }

  const { received, spent, net } = ctx.weekFinances
  const spendingRatio = received > 0 ? spent / received : 0

  const parts: string[] = []
  parts.push(`This week: **₦${received.toLocaleString()}** in, **₦${spent.toLocaleString()}** out, **₦${net.toLocaleString()}** net.`)

  if (net < 0) {
    parts.push('You are spending more than you are earning. This is not sustainable. Identify where the money is going and cut non-essential spending immediately.')
  } else if (spendingRatio > 0.8) {
    parts.push('Your spending-to-income ratio is dangerously high. You should aim to save at least 20% of what comes in.')
  } else if (net > 0) {
    parts.push('You have a positive net flow this week. Good discipline. Now think about where that surplus should go — savings, investment, or giving.')
  }

  // Top spending categories
  const categoryMap: Record<string, number> = {}
  for (const f of ctx.recentFinances.filter(f => f.type === 'spent')) {
    categoryMap[f.category] = (categoryMap[f.category] || 0) + f.amount
  }
  const topCats = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]).slice(0, 3)
  if (topCats.length > 0) {
    parts.push(`Top spending: ${topCats.map(([k, v]) => `**${k}** (₦${v.toLocaleString()})`).join(', ')}`)
  }

  return parts.join('\n\n')
}

function analyzeMood(ctx: LifeContext): string {
  if (ctx.recentMoodLogs.length === 0) {
    return 'No mood data recorded yet. Start logging your mood, energy, and focus to unlock pattern detection.'
  }

  const avgMood = Math.round(ctx.recentMoodLogs.reduce((s, l) => s + l.mood, 0) / ctx.recentMoodLogs.length * 10) / 10
  const avgEnergy = Math.round(ctx.recentMoodLogs.reduce((s, l) => s + l.energy, 0) / ctx.recentMoodLogs.length * 10) / 10
  const avgFocus = Math.round(ctx.recentMoodLogs.reduce((s, l) => s + l.focus, 0) / ctx.recentMoodLogs.length * 10) / 10

  const parts: string[] = []
  parts.push(`Your averages: Mood **${avgMood}/10**, Energy **${avgEnergy}/10**, Focus **${avgFocus}/10**.`)

  if (avgMood < 4) {
    parts.push('Your mood has been consistently low. This is a signal — not something to push through. Ask yourself: What is draining you? What would genuinely lift your spirit? Talk to someone you trust.')
  } else if (avgMood >= 7) {
    parts.push('Your mood is strong. Protect the habits and rhythms that produce this. What is working? Do more of it.')
  }

  if (avgEnergy < 4) {
    parts.push('Your energy is depleted. Sleep more. Eat better. Move your body. Low energy undermines everything else — this is not optional.')
  }

  if (avgFocus < 4) {
    parts.push('Your focus has been scattered. Consider: Are you trying to do too many things at once? Pick one priority and give it your full attention for 90 minutes.')
  }

  return parts.join('\n\n')
}

function generateGoalCoaching(ctx: LifeContext): string {
  if (ctx.activeGoals.length === 0) {
    return 'No active goals right now. Set at least one goal to give your days direction. Without goals, drift is inevitable.'
  }

  const parts: string[] = []
  parts.push(`You have **${ctx.activeGoals.length}** active goal${ctx.activeGoals.length > 1 ? 's' : ''}:`)

  for (const g of ctx.activeGoals.slice(0, 5)) {
    const done = g.tasks.filter(t => t.status === 'Completed').length
    const total = g.tasks.length
    const pct = total > 0 ? Math.round(done / total * 100) : 0
    parts.push(`- **[${AREA_LABELS[g.area] || g.area}]** ${g.title} — ${pct}% complete (${done}/${total} tasks)`)
  }

  // Find stalled goals (0% with tasks)
  const stalled = ctx.activeGoals.filter(g => g.tasks.length > 0 && g.tasks.filter(t => t.status === 'Completed').length === 0)
  if (stalled.length > 0) {
    parts.push(`\n**Warning:** ${stalled.length} goal${stalled.length > 1 ? 's' : ''} with zero progress: ${stalled.map(g => g.title).join(', ')}. This is where drift starts. Pick the most important one and complete one task today.`)
  }

  return parts.join('\n')
}

function generateDriftWarnings(ctx: LifeContext): string {
  if (ctx.activeAlerts.length === 0) return ''

  const parts: string[] = ['## Active Drift Alerts']
  for (const a of ctx.activeAlerts) {
    parts.push(`- **[${a.severity.toUpperCase()}] ${AREA_LABELS[a.area] || a.area}**: ${a.message}`)
  }
  return parts.join('\n')
}

/**
 * Generate a rich, contextual coaching response from data analysis.
 * This is the heart of the intelligent coaching engine.
 */
function generateCoachingResponse(message: string, ctx: LifeContext, checkInType?: string): string {
  const lowerMessage = message.toLowerCase()
  const scoreAnalysis = analyzeScores(ctx)

  // === CHECK-IN RESPONSES ===
  if (checkInType) {
    return generateCheckInResponse(checkInType, ctx, scoreAnalysis)
  }

  // === GREETING ===
  if (lowerMessage.match(/\b(hi|hello|hey|good morning|good evening|good afternoon)\b/)) {
    return generateGreeting(ctx, scoreAnalysis)
  }

  // === HELP/COACHING ===
  if (lowerMessage.match(/\b(help|guide|coach|advise|suggest|what should|coaching)\b/)) {
    return generateFullCoachingSession(ctx, scoreAnalysis)
  }

  // === FINANCE ===
  if (lowerMessage.match(/\b(money|finance|spent|received|budget|saving|naira|income|expense|₦)\b/)) {
    return generateFinanceResponse(ctx)
  }

  // === MOOD/FEELING ===
  if (lowerMessage.match(/\b(mood|feeling|tired|energ|stress|anxi|happy|sad|motivat|drain|overwhelm|exhaust|depress|burn|sleep|rest)\b/)) {
    return generateMoodResponse(ctx, scoreAnalysis)
  }

  // === GOALS/PROGRESS ===
  if (lowerMessage.match(/\b(goal|progress|track|accomplish|achieve|target|score|drift|move|stuck|stall)\b/)) {
    return generateProgressResponse(ctx, scoreAnalysis)
  }

  // === FAITH ===
  if (lowerMessage.match(/\b(faith|prayer|devotion|bible|scripture|god|spirit|church|worship)\b/)) {
    return generateAreaSpecificResponse('faith', ctx, scoreAnalysis)
  }

  // === HEALTH ===
  if (lowerMessage.match(/\b(health|gym|exercise|workout|sleep|diet|food|weight|energy|body)\b/)) {
    return generateAreaSpecificResponse('health', ctx, scoreAnalysis)
  }

  // === CAREER ===
  if (lowerMessage.match(/\b(career|job|work|cv|resume|interview|skill|professional|application)\b/)) {
    return generateAreaSpecificResponse('career', ctx, scoreAnalysis)
  }

  // === HAVILAH ===
  if (lowerMessage.match(/\b(havilah|business|entrepreneur|client|revenue|hub|writer)\b/)) {
    return generateAreaSpecificResponse('havilah', ctx, scoreAnalysis)
  }

  // === RELATIONSHIPS ===
  if (lowerMessage.match(/\b(relationship|family|friend|mentor|community|people|connect)\b/)) {
    return generateAreaSpecificResponse('relationships', ctx, scoreAnalysis)
  }

  // === DEFAULT: Full coaching overview ===
  return generateDefaultResponse(ctx, scoreAnalysis)
}

function generateCheckInResponse(type: string, ctx: LifeContext, scoreAnalysis: ReturnType<typeof analyzeScores>): string {
  const typeLabels: Record<string, string> = {
    morning: 'Morning Alignment',
    midday: 'Midday Correction',
    evening: 'Evening Review',
    friday: 'Friday Strategic Review',
    sunday: 'Sunday Planning',
  }
  const label = typeLabels[type] || type

  const parts: string[] = []
  parts.push(`## ${label} Received`)
  parts.push('')
  parts.push(`${label} logged, . Here's where you actually stand. No sugar-coating.`)
  parts.push('')

  // Score snapshot
  if (ctx.recentScores.length > 0) {
    const s = ctx.recentScores[0]
    parts.push('## Truth of the Moment')
    parts.push('')
    parts.push(`Overall alignment: **${s.overall}/10**`)
    parts.push('')
    parts.push(`| Area | Score | Status |`)
    parts.push(`|------|-------|--------|`)
    const areas = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth'] as const
    for (const a of areas) {
      const score = s[a] as number
      const status = score <= 2 ? 'Critical' : score <= 4 ? 'Needs Work' : score <= 6 ? 'Moderate' : score <= 8 ? 'Good' : 'Strong'
      parts.push(`| ${AREA_LABELS[a]} | **${score}/10** | ${status} |`)
    }
    parts.push('')

    if (scoreAnalysis.lowest.length > 0) {
      parts.push(`> **Warning:** ${scoreAnalysis.lowest.map(a => AREA_LABELS[a]).join(', ')} ${scoreAnalysis.lowest.length > 1 ? 'are' : 'is'} critically low. This needs immediate attention.`)
      parts.push('')
    }
  }

  // Goal progress
  if (ctx.activeGoals.length > 0) {
    parts.push('## Active Goals')
    parts.push('')
    for (const g of ctx.activeGoals.slice(0, 4)) {
      const done = g.tasks.filter(t => t.status === 'Completed').length
      const total = g.tasks.length
      parts.push(`- **[${AREA_LABELS[g.area] || g.area}]** ${g.title} — ${done}/${total} tasks done`)
    }
    parts.push('')
  }

  // Drift alerts
  if (ctx.activeAlerts.length > 0) {
    parts.push(generateDriftWarnings(ctx))
    parts.push('')
  }

  // Finance snapshot
  if (ctx.weekFinances.count > 0) {
    parts.push('## Financial Snapshot')
    parts.push('')
    parts.push(analyzeFinances(ctx))
    parts.push('')
  }

  // Mood snapshot
  if (ctx.recentMoodLogs.length > 0) {
    parts.push('## Mood & Energy')
    parts.push('')
    parts.push(analyzeMood(ctx))
    parts.push('')
  }

  // Type-specific coaching
  parts.push('## Required Actions')
  parts.push('')
  if (type === 'morning') {
    parts.push('> **Before you start today:** What is the ONE outcome that would make today a win? Protect that time block ruthlessly. Everything else is secondary.')
  } else if (type === 'evening') {
    parts.push("> **Tonight's reflection:** What is one thing you did today that your future self will thank you for? And one thing you need to correct tomorrow? Name both.")
  } else if (type === 'midday') {
    parts.push('> **Midday check:** Are you working on what matters most right now, or just what feels most urgent? Recalibrate if needed.')
  } else if (type === 'friday') {
    parts.push('> **Weekly verdict:** Be honest — did this week move you closer to the life you want, or did you just stay busy? The difference matters.')
  } else if (type === 'sunday') {
    parts.push('> **Sunday planning:** Next week deserves intention, not reaction. Block your deep work now before the week fills up with noise.')
  }

  return parts.join('\n')
}

function generateGreeting(ctx: LifeContext, scoreAnalysis: ReturnType<typeof analyzeScores>): string {
  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const parts: string[] = []
  parts.push(`${timeGreeting}, . Let's get to work.`)
  parts.push('')

  // Quick status
  if (ctx.recentScores.length > 0) {
    const s = ctx.recentScores[0]
    parts.push(`Your current alignment: **${s.overall}/10** overall.`)
    if (scoreAnalysis.lowest.length > 0) {
      parts.push(`**${scoreAnalysis.lowest.map(a => AREA_LABELS[a]).join(', ')}** ${scoreAnalysis.lowest.length > 1 ? 'need' : 'needs'} urgent attention. Fix this now.`)
    }
    if (scoreAnalysis.highest.length > 0) {
      parts.push(`**${scoreAnalysis.highest.map(a => AREA_LABELS[a]).join(', ')}** ${scoreAnalysis.highest.length > 1 ? 'are' : 'is'} solid. Now bring the rest up to match.`)
    }
    parts.push('')
  }

  if (ctx.activeAlerts.length > 0) {
    parts.push(`You have **${ctx.activeAlerts.length} drift alert${ctx.activeAlerts.length > 1 ? 's' : ''}** that need${ctx.activeAlerts.length === 1 ? 's' : ''} attention.`)
  }

  if (ctx.activeGoals.length > 0) {
    parts.push(`You're working on **${ctx.activeGoals.length} goal${ctx.activeGoals.length > 1 ? 's' : ''}** right now.`)
  }

  parts.push('')
  parts.push('What are we tackling today? Be specific.')
  parts.push('- Log a **check-in** for accountability')
  parts.push('- Review your **goals and progress**')
  parts.push('- Check your **finances**')
  parts.push('- Assess your **mood and energy**')
  parts.push('- Get **coaching** on any life area')

  return parts.join('\n')
}

function generateFullCoachingSession(ctx: LifeContext, scoreAnalysis: ReturnType<typeof analyzeScores>): string {
  const parts: string[] = []
  parts.push("Let me give you the full picture, . No sugar-coating.")
  parts.push('')

  // Life scores
  if (ctx.recentScores.length > 0) {
    parts.push('## Life Score Assessment')
    parts.push('')
    parts.push(scoreAnalysis.analysis)
    parts.push('')

    if (scoreAnalysis.lowest.length > 0) {
      parts.push('### Areas Needing Urgent Attention')
      parts.push('')
      for (const a of scoreAnalysis.lowest) {
        const progress = ctx.lifeAreaProgress.find(lap => lap.area === a)
        parts.push(`**${AREA_LABELS[a]}:**`)
        if (progress?.blockers) {
          parts.push(`- Blocker: ${progress.blockers}`)
        }
        parts.push(`- Action: What is one thing you can do TODAY to move this from ${scoreAnalysis.lowest.includes(a) ? 'critical' : 'low'} to moderate?`)
      }
      parts.push('')
    }
  }

  // Goal coaching
  if (ctx.activeGoals.length > 0) {
    parts.push('## Goal Progress')
    parts.push('')
    parts.push(generateGoalCoaching(ctx))
    parts.push('')
  }

  // Drift
  if (ctx.activeAlerts.length > 0) {
    parts.push(generateDriftWarnings(ctx))
    parts.push('')
  }

  // Finance
  if (ctx.weekFinances.count > 0) {
    parts.push('## Financial Reality Check')
    parts.push('')
    parts.push(analyzeFinances(ctx))
    parts.push('')
  }

  // Mood
  if (ctx.recentMoodLogs.length > 0) {
    parts.push('## Mood & Energy Status')
    parts.push('')
    parts.push(analyzeMood(ctx))
    parts.push('')
  }

  // Bottom line
  parts.push('## Your Move')
  parts.push('')
  if (scoreAnalysis.lowest.length > 0) {
    parts.push(`> **Priority #1:** Address **${AREA_LABELS[scoreAnalysis.lowest[0]]}**. This is dragging everything else down. One action today.`)
  } else {
    parts.push('> You have the foundation. Now push for excellence. What is the one thing that would make the biggest difference this week?')
  }

  return parts.join('\n')
}

function generateFinanceResponse(ctx: LifeContext): string {
  const parts: string[] = []
  parts.push("Let's talk money, . Financial stewardship is not optional.")
  parts.push('')

  parts.push('## Financial Snapshot')
  parts.push('')
  parts.push(analyzeFinances(ctx))
  parts.push('')

  if (ctx.recentFinances.length > 0) {
    parts.push('## Recent Transactions')
    parts.push('')
    for (const f of ctx.recentFinances.slice(0, 5)) {
      const typeLabel = f.type === 'received' ? '**In**' : '**Out**'
      parts.push(`- ${typeLabel}: ₦${f.amount.toLocaleString()} — ${f.category}${f.purpose ? ` (${f.purpose})` : ''}`)
    }
    parts.push('')
  }

  parts.push('## Financial Discipline Reminders')
  parts.push('')
  parts.push('- **Track every naira** — Money that isn\'t tracked will drift')
  parts.push('- **Ask before spending** — Is this aligned with your goals, or is it impulse?')
  parts.push('- **Review weekly** — Where is your money actually going?')
  parts.push('- **Save first** — Before spending, set aside your savings target')
  parts.push('')
  parts.push('> Log your finances in the **Finances** section so we can spot patterns together.')

  return parts.join('\n')
}

function generateMoodResponse(ctx: LifeContext, scoreAnalysis: ReturnType<typeof analyzeScores>): string {
  const parts: string[] = []
  parts.push("Your emotional and physical state drives everything else. Here's the data.")
  parts.push('')

  parts.push('## Mood & Energy Analysis')
  parts.push('')
  parts.push(analyzeMood(ctx))
  parts.push('')

  // Connect mood to scores
  if (scoreAnalysis.lowest.includes('health')) {
    parts.push('> Your **Health** score is low, which directly impacts mood and energy. Sleep, nutrition, and movement are not luxuries — they are the foundation.')
    parts.push('')
  }

  parts.push('> **Your mood is data, not destiny.** Acknowledge it. Then act. What is one thing you will do right now to shift your state?')

  return parts.join('\n')
}

function generateProgressResponse(ctx: LifeContext, scoreAnalysis: ReturnType<typeof analyzeScores>): string {
  const parts: string[] = []
  parts.push("Let's look at where you actually are, . Not where you wish you were.")
  parts.push('')

  if (ctx.recentScores.length > 0) {
    parts.push('## Life Score Trend')
    parts.push('')
    const s = ctx.recentScores[0]
    const areas = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth'] as const
    for (const a of areas) {
      parts.push(`- **${AREA_LABELS[a]}:** ${s[a]}/10`)
    }
    parts.push(`- **Overall:** ${s.overall}/10`)
    parts.push('')

    if (ctx.recentScores.length >= 2) {
      const prev = ctx.recentScores[ctx.recentScores.length - 1]
      const diff = s.overall - prev.overall
      if (diff > 0) {
        parts.push(`Your overall score has **improved by ${diff} points** since your last assessment. Keep going.`)
      } else if (diff < 0) {
        parts.push(`Your overall score has **dropped by ${Math.abs(diff)} points** since your last assessment. This is drift in action.`)
      } else {
        parts.push('Your overall score is **unchanged**. Stability is good, but are you growing or just maintaining?')
      }
      parts.push('')
    }
  }

  parts.push('## Goal Progress')
  parts.push('')
  parts.push(generateGoalCoaching(ctx))
  parts.push('')

  if (ctx.activeAlerts.length > 0) {
    parts.push(generateDriftWarnings(ctx))
    parts.push('')
  }

  parts.push('> **The question that matters:** Are you moving toward the life you want, or just staying busy? Be honest with yourself.')

  return parts.join('\n')
}

function generateAreaSpecificResponse(area: string, ctx: LifeContext, scoreAnalysis: ReturnType<typeof analyzeScores>): string {
  const label = AREA_LABELS[area] || area
  const latestScore = ctx.recentScores.length > 0 ? ctx.recentScores[0][area as keyof typeof ctx.recentScores[0]] : null
  const progress = ctx.lifeAreaProgress.find(lap => lap.area === area)
  const goals = ctx.activeGoals.filter(g => g.area === area)
  const alerts = ctx.activeAlerts.filter(a => a.area === area)

  const parts: string[] = []
  parts.push(`Let me give you an honest assessment of your **${label}**.`)
  parts.push('')

  // Score
  if (latestScore !== null) {
    const status = (latestScore as number) <= 3 ? 'This is critical' : (latestScore as number) <= 5 ? 'Needs attention' : (latestScore as number) <= 7 ? 'Moderate' : 'Doing well'
    parts.push(`## Current Score: **${latestScore}/10** — ${status}`)
    parts.push('')
  }

  // Progress / vision
  if (progress) {
    if (progress.idealVision) {
      parts.push('## Your Vision')
      parts.push('')
      parts.push(progress.idealVision)
      parts.push('')
    }
    if (progress.currentStatus) {
      parts.push('## Current Reality')
      parts.push('')
      parts.push(progress.currentStatus)
      parts.push('')
    }
    if (progress.blockers) {
      parts.push('## Blockers')
      parts.push('')
      parts.push(progress.blockers)
      parts.push('')
    }
  }

  // Goals
  if (goals.length > 0) {
    parts.push('## Goals in This Area')
    parts.push('')
    for (const g of goals) {
      const done = g.tasks.filter(t => t.status === 'Completed').length
      parts.push(`- **${g.title}** — ${done}/${g.tasks.length} tasks done`)
      for (const t of g.tasks.filter(t => t.status !== 'Completed').slice(0, 3)) {
        parts.push(`  - ${t.title}`)
      }
    }
    parts.push('')
  }

  // Alerts
  if (alerts.length > 0) {
    parts.push('## Drift Alerts')
    parts.push('')
    for (const a of alerts) {
      parts.push(`- **${a.severity}:** ${a.message}`)
    }
    parts.push('')
  }

  // Specific coaching per area
  parts.push('## Coach\'s Assessment')
  parts.push('')
  if (area === 'faith') {
    parts.push('Your spiritual life is the foundation of everything else. If this area is weak, everything else will eventually crack.')
    parts.push('')
    parts.push('> **Today\'s move:** Set a non-negotiable devotion time. Even 15 minutes of prayer and scripture before the day begins will shift everything.')
  } else if (area === 'health') {
    parts.push('Your body is the vehicle for everything God has called you to do. Ignoring it is not discipline — it\'s self-sabotage.')
    parts.push('')
    parts.push('> **Today\'s move:** Set a bedtime tonight. 7-8 hours of sleep is non-negotiable. Everything else depends on it.')
  } else if (area === 'career') {
    parts.push('Your career is how you steward your professional gifts. Intentionality here creates options and financial freedom.')
    parts.push('')
    parts.push('> **Today\'s move:** Spend 30 minutes on your CV or one job application. Small daily progress compounds.')
  } else if (area === 'havilah') {
    parts.push('Havilah is your entrepreneurial calling. But activity is not progress. Ask: Did this move the business forward? Produce revenue? Build capacity?')
    parts.push('')
    parts.push('> **Today\'s move:** Identify the ONE thing that would move Havilah forward this week. Then do it before anything else.')
  } else if (area === 'finances') {
    parts.push(analyzeFinances(ctx))
  } else if (area === 'relationships') {
    parts.push('Relationships are the context for life. Isolation is dangerous. Connection is fuel.')
    parts.push('')
    parts.push('> **Today\'s move:** Reach out to one person. A text, a call, a prayer. Relationships don\'t maintain themselves.')
  } else if (area === 'personalGrowth') {
    parts.push('Growth is not automatic. If you\'re not intentionally learning, you\'re slowly becoming obsolete.')
    parts.push('')
    parts.push('> **Today\'s move:** Read for 20 minutes. Write one reflection. Learn one new thing. Small inputs, compounding returns.')
  }

  return parts.join('\n')
}

function generateDefaultResponse(ctx: LifeContext, scoreAnalysis: ReturnType<typeof analyzeScores>): string {
  const parts: string[] = []
  parts.push("Let me give you the full picture of where you stand right now, .")
  parts.push('')

  // Score
  if (ctx.recentScores.length > 0) {
    parts.push('## Your Current Standing')
    parts.push('')
    parts.push(scoreAnalysis.analysis)
    parts.push('')
  }

  // Goals
  if (ctx.activeGoals.length > 0) {
    parts.push(generateGoalCoaching(ctx))
    parts.push('')
  }

  // Drift
  if (ctx.activeAlerts.length > 0) {
    parts.push(generateDriftWarnings(ctx))
    parts.push('')
  }

  // Finance
  if (ctx.weekFinances.count > 0) {
    parts.push('## Financial Snapshot')
    parts.push('')
    parts.push(analyzeFinances(ctx))
    parts.push('')
  }

  // Bottom line
  parts.push('## What Matters Right Now')
  parts.push('')
  parts.push('- **Alignment over activity** — Are your actions today moving you toward your vision?')
  parts.push('- **Discipline is freedom** — Every small decision compounds')
  parts.push('- **Drift is silent** — Check your life scores regularly')
  parts.push('')

  if (scoreAnalysis.lowest.length > 0) {
    parts.push(`> **Priority:** ${AREA_LABELS[scoreAnalysis.lowest[0]]} needs your attention. One action today will start turning it around.`)
  } else {
    parts.push('> Stop being vague. Share specifics and I will give you exact, actionable steps. No more generalities.')
  }

  return parts.join('\n')
}

// GET /api/chat — Retrieve chat history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // ── Health check sub-path ──
    // GET /api/chat?health=1 — lightweight check if the endpoint is reachable
    // without loading any messages. Used by the chat client to test connectivity.
    if (searchParams.get('health') === '1') {
      return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const before = searchParams.get('before') // cursor: message ID to paginate before
    // When `latest=true`, return the NEWEST `limit` messages (in asc order for
    // display). Used by the chat client to fetch a server-side fallback after
    // an empty stream — without this flag the endpoint returns the OLDEST
    // `limit` messages, which would miss freshly-saved fallback responses on
    // established accounts.
    const latest = searchParams.get('latest') === 'true'

    const where = before ? { createdAt: { lt: (await db.chatMessage.findUnique({ where: { id: before } }))?.createdAt ?? new Date() } } : {}

    let messages
    if (latest) {
      messages = await db.chatMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      // Reverse to asc so callers can render oldest→newest consistently.
      messages.reverse()
    } else {
      messages = await db.chatMessage.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: limit,
      })
    }

    return NextResponse.json({
      messages: messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        checkInType: m.checkInType,
        timestamp: m.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Chat GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch chat history' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 30 messages per minute per IP
    const ip = getClientIp(request)
    const rl = rateLimit(`chat:${ip}`, 30, 60_000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } }
      )
    }

    const rawBody = await request.json()
    const parsed = ChatMessageSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const body = parsed.data as ChatRequestBody
    const { checkInType, history, stream: streamMode } = body
    const message = sanitizeForAI(body.message)
    const today = getTodayInTimezone()

    // Server-side strict mode enforcement for check-ins
    if (checkInType) {
      try {
        const settingsRecord = await db.settings.findUnique({ where: { key: 'user_settings' } })
        if (settingsRecord) {
          const settings = JSON.parse(settingsRecord.value)
          const checkInWindows = settings.checkInWindows || {}
          const { allowed, message: strictMessage } = isWithinCheckInWindowServer(checkInType, {
            strictMode: checkInWindows.strictMode ?? false,
            morningEnabled: checkInWindows.morningEnabled ?? true,
            morningTime: checkInWindows.morningTime ?? '05:00',
            eveningEnabled: checkInWindows.eveningEnabled ?? true,
            eveningTime: checkInWindows.eveningTime ?? '20:30',
            windowMinutes: checkInWindows.windowMinutes ?? 60,
          })
          if (!allowed) {
            return NextResponse.json(
              { error: 'Check-in window closed', message: strictMessage || 'Strict mode is enabled. Please check in during your scheduled window.' },
              { status: 403 }
            )
          }
        }
      } catch (settingsError) {
        console.error('Failed to check strict mode settings:', settingsError)
      }
    }

    // Store user message — best-effort. A transient DB write failure (e.g.
    // readonly SQLite in some sandboxes, or a momentary PostgreSQL connection
    // hiccup on Vercel) must NOT block the AI response. We log and continue;
    // the user's message simply won't appear in history, which is far better
    // than surfacing a hard 500 "Failed to generate response" to the user.
    let userMessage: { id: string } | null = null
    try {
      userMessage = await db.chatMessage.create({
        data: {
          role: 'user',
          content: message,
          checkInType: checkInType || null,
        },
      })
    } catch (userMsgErr) {
      console.error('Failed to persist user message (continuing anyway):', userMsgErr)
    }

    // Build context from database (used by both AI and fallback)
    const ctx = await buildContext()
    let assistantContent = ''
    let usedAI = false

    // Try to get AI response with retry
    try {
      const contextStr = formatContextForAI(ctx)

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: MYOS_SYSTEM_PROMPT },
      ]

      if (contextStr) {
        // DeepSeek-V3 (deepseek-chat) has a 64K context window — allow plenty of
        // context so the AI can see all check-ins, entries, and history for the day.
        const truncated = contextStr.length > 24000
          ? contextStr.slice(0, 24000) + '\n[...context truncated for brevity...]'
          : contextStr
        messages.push({
          role: 'system',
          content: `CURRENT CONTEXT FOR THIS CONVERSATION:\n${truncated}`,
        })
      }

      if (history && Array.isArray(history)) {
        for (const msg of history.slice(-30)) {
          messages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })
        }
      }

      messages.push({ role: 'user', content: message })

      // ── Streaming path ──
      if (streamMode) {
        try {
          const openai = getOpenAIClient()

          // deepseek-chat = DeepSeek-V3. Fast (2–8s), conversational, streams
          // the first token immediately, and supports temperature for varied
          // coaching responses. This is the correct model for real-time chat.
          // (deepseek-reasoner / R1 was used previously — it thinks for 30–120s
          // before replying, which caused client timeouts and broke memory
          // persistence because the fire-and-forget smart-sync never ran.)
          const stream = await openai.chat.completions.create({
            model: 'deepseek-chat',
            messages: messages as OpenAI.ChatCompletionMessageParam[],
            max_tokens: 4000,
            temperature: 0.7,
            stream: true,
          })

          const encoder = new TextEncoder()
          let fullText = ''

          // We use a promise to track when the stream finishes so we can save
          // the assistant message to the DB AFTER the response is sent. This is
          // critical: if we save inside ReadableStream.start(), the DB write may
          // never complete if the client disconnects mid-stream (mobile, network
          // drops, tab close). By moving the save to a fire-and-forget promise
          // that's independent of the stream lifecycle, we ensure the assistant
          // response is ALWAYS persisted even if the client disconnects.
          let streamResolve: (text: string) => void
          const streamDone = new Promise<string>(resolve => { streamResolve = resolve })

          const readable = new ReadableStream({
            async start(controller) {
              try {
                for await (const chunk of stream) {
                  // Skip internal reasoning tokens — only stream the final answer
                  const delta = chunk.choices[0]?.delta as { content?: string; reasoning_content?: string }
                  const content = delta?.content
                  if (content) {
                    fullText += content
                    controller.enqueue(encoder.encode(content))
                  }
                }
                // Signal to the client that the stream completed normally
                controller.enqueue(encoder.encode('\x00[DONE]'))
              } catch (streamErr) {
                console.error('Stream iteration error:', streamErr)
                // Signal stream error to client
                controller.enqueue(encoder.encode('\x00[ERROR]'))
              }

              // Fallback: if the OpenAI stream produced nothing (e.g. it
              // errored immediately or returned zero chunks), synthesize a
              // real coaching response and stream it to the client so the
              // user never sees an empty AI bubble. The fallback is also
              // persisted to the DB below — mirroring the normal success path.
              if (!fullText) {
                let fallback = ''
                try {
                  fallback = generateCoachingResponse(message, ctx, checkInType)
                } catch (genErr) {
                  console.error('Fallback generateCoachingResponse failed:', genErr)
                }
                if (!fallback) {
                  fallback = "I'm here. Tell me more about what's going on."
                }
                fullText = fallback
                try {
                  controller.enqueue(encoder.encode(fallback))
                } catch (enqueueErr) {
                  console.error('Fallback enqueue error:', enqueueErr)
                }
              }

              controller.close()
              // Resolve the promise with the full text so the DB save
              // can happen independently of the stream lifecycle.
              streamResolve(fullText)
            },
          })

          // Fire-and-forget: save the assistant message to the DB after the
          // stream completes. This runs independently of the client connection
          // state — even if the client disconnects, this promise resolves and
          // the message is persisted.
          streamDone.then(async (text) => {
            if (!text) return
            try {
              await db.chatMessage.create({
                data: {
                  role: 'assistant',
                  content: text,
                  checkInType: checkInType || null,
                },
              })

              if (checkInType) {
                await db.checkIn.upsert({
                  where: { id: `${today}-${checkInType}` },
                  create: {
                    id: `${today}-${checkInType}`,
                    type: checkInType,
                    date: today,
                    data: JSON.stringify({ message }),
                    aiResponse: JSON.stringify({ response: text }),
                  },
                  update: {
                    data: JSON.stringify({ message }),
                    aiResponse: JSON.stringify({ response: text }),
                  },
                })
              }

              // Fire-and-forget smart-sync
              fetch(new URL('/api/smart-sync', request.url), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, checkInType }),
              }).catch(syncErr => console.error('Smart-sync error in streaming chat:', syncErr))

              // Fire-and-forget streak recalculation
              recalcStreaks(checkInType || undefined).catch(() => {})
            } catch (dbErr) {
              console.error('Post-stream DB save error:', dbErr)
            }
          }).catch(err => {
            console.error('Stream done promise error:', err)
          })

          return new Response(readable, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
              'X-Accel-Buffering': 'no',
              'Transfer-Encoding': 'chunked',
            },
          })
        } catch (streamInitError) {
          console.error('Streaming init failed, falling back to non-streaming:', streamInitError)
          // Fall through to non-streaming path below
        }
      }

      // ── Non-streaming path ──
      // deepseek-chat (V3) supports temperature — use 0.7 for varied, natural
      // coaching responses instead of robotic deterministic output.
      const aiResponse = await callZAIWithRetry(messages, 2, { temperature: 0.7 })
      if (aiResponse) {
        assistantContent = aiResponse
        usedAI = true
      }
    } catch (aiError) {
      console.error('AI generation failed, using intelligent fallback:', aiError)
    }

    // Use intelligent coaching engine if AI didn't produce a response
    if (!usedAI) {
      assistantContent = generateCoachingResponse(message, ctx, checkInType)
    }

    // Store assistant message — best-effort (mirror of user-message handling).
    // If the DB write fails we still return the generated response to the
    // client rather than 500ing.
    let assistantMessage: { id: string } | null = null
    try {
      assistantMessage = await db.chatMessage.create({
        data: {
          role: 'assistant',
          content: assistantContent,
          checkInType: checkInType || null,
        },
      })
    } catch (assistantMsgErr) {
      console.error('Failed to persist assistant message (returning response anyway):', assistantMsgErr)
    }

    // Store check-in if type is provided — best-effort. A DB failure here
    // must not prevent the response from being returned.
    if (checkInType) {
      try {
        await db.checkIn.upsert({
          where: { id: `${today}-${checkInType}` },
          create: {
            id: `${today}-${checkInType}`,
            type: checkInType,
            date: today,
            data: JSON.stringify({ message }),
            aiResponse: JSON.stringify({ response: assistantContent }),
          },
          update: {
            data: JSON.stringify({ message }),
            aiResponse: JSON.stringify({ response: assistantContent }),
          },
        })
      } catch (checkInErr) {
        console.error('Failed to persist check-in (returning response anyway):', checkInErr)
      }
      // Recalculate streaks after check-in
      recalcStreaks(checkInType).catch(() => {})
    }

    // Smart-sync
    let syncResult = { goalsUpdated: 0, tasksUpdated: 0, financeEntriesCreated: 0 }
    try {
      const syncRes = await fetch(new URL('/api/smart-sync', request.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, checkInType }),
      })
      if (syncRes.ok) {
        const syncData = await syncRes.json()
        if (syncData.applied) {
          syncResult = syncData.applied
        }
      }
    } catch (syncError) {
      console.error('Smart-sync error in chat:', syncError)
    }

    return NextResponse.json({
      response: assistantContent,
      messageId: assistantMessage?.id ?? null,
      userMessageId: userMessage?.id ?? null,
      syncResult,
      _meta: { usedAI },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    )
  }
}

// DELETE /api/chat — Clear all chat history
// Called by the "New Chat" button to permanently delete all messages
// from the database so they don't reappear on refresh.
export async function DELETE() {
  try {
    const result = await db.chatMessage.deleteMany({})
    console.log(`[Chat DELETE] Cleared ${result.count} messages`)
    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `Cleared ${result.count} chat messages.`,
    })
  } catch (error) {
    console.error('Chat DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to clear chat history' },
      { status: 500 }
    )
  }
}
