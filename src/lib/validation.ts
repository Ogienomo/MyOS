import { z } from 'zod'

export const VALID_AREAS = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth', 'general'] as const
export const VALID_MOODS = ['great', 'good', 'okay', 'low', 'struggling'] as const
export const VALID_LIFE_AREAS = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth'] as const
export const VALID_GOAL_STATUSES = ['Not Started', 'In Progress', 'Completed', 'Paused'] as const
export const VALID_TASK_STATUSES = ['Not Started', 'In Progress', 'Completed', 'Skipped'] as const
export const VALID_FINANCE_TYPES = ['received', 'spent'] as const
export const VALID_CHECKIN_TYPES = ['morning', 'midday', 'evening', 'friday', 'sunday'] as const

export const ScoreSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  faith: z.number().min(0).max(10).optional(),
  health: z.number().min(0).max(10).optional(),
  career: z.number().min(0).max(10).optional(),
  havilah: z.number().min(0).max(10).optional(),
  finances: z.number().min(0).max(10).optional(),
  relationships: z.number().min(0).max(10).optional(),
  personalGrowth: z.number().min(0).max(10).optional(),
  overall: z.number().min(0).max(10).optional(),
})

export const GoalCreateSchema = z.object({
  area: z.string().min(1).max(64),
  title: z.string().min(1).max(256),
  description: z.string().max(2000).optional().nullable(),
  whyItMatters: z.string().max(1000).optional().nullable(),
  successMetric: z.string().max(500).optional().nullable(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
})

export const GoalUpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(256).optional(),
  description: z.string().max(2000).optional().nullable(),
  whyItMatters: z.string().max(1000).optional().nullable(),
  successMetric: z.string().max(500).optional().nullable(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z.enum(VALID_GOAL_STATUSES).optional(),
  order: z.number().int().min(0).optional(),
})

export const FinanceCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  type: z.enum(VALID_FINANCE_TYPES),
  amount: z.number().positive('Amount must be positive').max(1_000_000_000),
  category: z.string().min(1).max(128),
  purpose: z.string().max(500).optional().nullable(),
  aligned: z.boolean().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export const JournalCreateSchema = z.object({
  area: z.enum(VALID_AREAS),
  title: z.string().max(256).optional().nullable(),
  content: z.string().min(1).max(50000),
  mood: z.enum(VALID_MOODS).optional().nullable(),
  tags: z.string().max(500).optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
})

export const ChatMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  checkInType: z.enum(VALID_CHECKIN_TYPES).optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(10000),
  })).max(50).optional(),
  stream: z.boolean().optional(),
  image_base64: z.string().max(10_000_000).optional(),
})

export const QuickLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  mood: z.number().int().min(1).max(10),
  energy: z.number().int().min(1).max(10),
  focus: z.number().int().min(1).max(10),
  note: z.string().max(1000).optional().nullable(),
})

export const HabitSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  area: z.string().max(64).optional().nullable(),
  targetCount: z.number().int().positive().optional(),
})

export const SavingsGoalSchema = z.object({
  name: z.string().min(1).max(200),
  targetAmount: z.number().positive().max(1_000_000_000),
  savedAmount: z.number().min(0).max(1_000_000_000).optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  area: z.string().max(64).optional().nullable(),
})

/** Strip dangerous prompt-injection patterns from user text before sending to AI */
export function sanitizeForAI(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '[code block removed]')
    .replace(/\[INST\][\s\S]*?\[\/INST\]/gi, '')
    .replace(/<\|.*?\|>/g, '')
    .replace(/ignore (all |previous |above |prior )?(instructions|prompts|rules)/gi, '[filtered]')
    .replace(/you are now|act as|pretend (to be|you are)/gi, '[filtered]')
    .trim()
    .slice(0, 10000)
}

/** Clamp a score to [0, 10], rounding to 1 decimal place */
export function clampScore(v: unknown): number | undefined {
  if (typeof v !== 'number' || isNaN(v)) return undefined
  return Math.round(Math.min(10, Math.max(0, v)) * 10) / 10
}
