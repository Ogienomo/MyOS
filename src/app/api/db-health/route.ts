import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/db-health
// Diagnostic endpoint that reports database type, whether writes persist,
// and AI provider status. Use this to verify your Vercel deployment is
// correctly configured after setting environment variables.
//
// A healthy production deployment should show:
//   database.provider = "postgresql"
//   database.persistenceLikely = true
//   database.writeTest = "passed"
//   ai.configured = true
export async function GET() {
  const dbUrl = process.env.DATABASE_URL || ''
  const isProd = process.env.NODE_ENV === 'production'

  // Detect provider from DATABASE_URL scheme (more reliable than guessing
  // from the client, since the Prisma provider was patched at build time).
  let provider: 'postgresql' | 'sqlite' | 'unknown'
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    provider = 'postgresql'
  } else if (dbUrl.startsWith('file:')) {
    provider = 'sqlite'
  } else {
    provider = 'unknown'
  }

  // On Vercel serverless, SQLite's filesystem is ephemeral — data does NOT
  // survive between invocations. Only PostgreSQL (or another network DB)
  // provides true persistence.
  const persistenceLikely = provider === 'postgresql'

  // ── Write/read/delete round-trip test ────────────────────────────────────
  // We use the Settings model (key-value store) to avoid polluting real data
  // tables. We write a unique probe value, read it back, then delete it.
  let writeTest: 'passed' | 'failed' | 'skipped' = 'skipped'
  let writeTestDetail = ''
  const probeKey = `__db_health_probe_${Date.now()}__`
  const probeValue = `ok-${Date.now()}`

  try {
    await db.settings.create({
      data: { key: probeKey, value: JSON.stringify({ probe: probeValue }) },
    })
    const readBack = await db.settings.findUnique({ where: { key: probeKey } })
    if (readBack && JSON.parse(readBack.value).probe === probeValue) {
      writeTest = 'passed'
      writeTestDetail = 'Write → read round-trip succeeded.'
    } else {
      writeTest = 'failed'
      writeTestDetail = 'Read-back value did not match written value.'
    }
    // Clean up the probe row
    await db.settings.delete({ where: { key: probeKey } }).catch(() => {})
  } catch (err) {
    writeTest = 'failed'
    writeTestDetail = err instanceof Error ? err.message : String(err)
  }

  // ── Record counts (so the user can see if data exists) ───────────────────
  let recordCounts: Record<string, number> = {}
  const models = [
    'chatMessage', 'checkIn', 'journalEntry', 'memory', 'goal', 'task',
    'financeEntry', 'habit', 'quickLog', 'lifeAreaScore', 'streak',
  ]
  for (const model of models) {
    try {
      const count = await (db as any)[model].count()
      recordCounts[model] = typeof count === 'number' ? count : 0
    } catch {
      recordCounts[model] = -1 // table missing or error
    }
  }

  // ── AI status ─────────────────────────────────────────────────────────────
  // DeepSeek powers the AI Coach (deepseek-chat / DeepSeek-V3).
  // OpenAI is optional — only for Whisper ASR, TTS, and DALL-E.
  const deepseekConfigured = !!process.env.DEEPSEEK_API_KEY
  const openaiConfigured = !!process.env.OPENAI_API_KEY
  const aiConfigured = deepseekConfigured

  // ── Build response ────────────────────────────────────────────────────────
  const status = persistenceLikely && writeTest === 'passed' && aiConfigured
    ? 'healthy'
    : persistenceLikely && writeTest === 'passed'
      ? 'degraded' // DB ok but AI not configured
      : 'unhealthy'

  const warnings: string[] = []
  if (provider === 'sqlite' && isProd) {
    warnings.push(
      'CRITICAL: Database is SQLite in a production environment. ' +
      'Vercel serverless functions have an ephemeral filesystem — data ' +
      'will NOT persist between requests. Set DATABASE_URL to a PostgreSQL ' +
      'connection string (e.g. Neon) in Vercel → Settings → Environment Variables, ' +
      'then redeploy.'
    )
  }
  if (provider === 'unknown') {
    warnings.push(
      'DATABASE_URL is not set or has an unrecognized scheme. ' +
      'Set it to a PostgreSQL connection string for production persistence.'
    )
  }
  if (writeTest === 'failed') {
    warnings.push(
      `Database write test failed: ${writeTestDetail}. ` +
      'The database may be read-only, full, or unreachable.'
    )
  }
  if (!deepseekConfigured) {
    warnings.push(
      'DEEPSEEK_API_KEY is not set. The AI Coach will use the built-in ' +
      'fallback coaching engine (no LLM). Add DEEPSEEK_API_KEY in Vercel ' +
      'environment variables to enable full AI (DeepSeek-V3). ' +
      'Get a key at https://platform.deepseek.com/api_keys'
    )
  }
  if (!openaiConfigured) {
    warnings.push(
      'OPENAI_API_KEY is not set (optional). Voice transcription (Whisper), ' +
      'TTS, and image generation will be unavailable. The rest of the app ' +
      'works without it.'
    )
  }

  // ── Persistence verdict (plain-English summary) ─────────────────────────
  let persistenceVerdict = 'unknown'
  if (provider === 'postgresql' && writeTest === 'passed') {
    persistenceVerdict = 'PERSISTENT — PostgreSQL is connected and accepting writes. Data will survive across requests.'
  } else if (provider === 'postgresql' && writeTest === 'failed') {
    persistenceVerdict = 'BROKEN — DATABASE_URL points to PostgreSQL but the write test failed. The database may be unreachable, the connection string may be wrong, or tables were not created (run prisma db push). See writeTestDetail.'
  } else if (provider === 'sqlite' && isProd) {
    persistenceVerdict = 'EPHEMERAL — SQLite on Vercel serverless does NOT persist. Set DATABASE_URL to a PostgreSQL connection string.'
  } else if (provider === 'sqlite') {
    persistenceVerdict = 'LOCAL — SQLite is fine for local development. Data persists locally only.'
  } else {
    persistenceVerdict = 'UNCONFIGURED — DATABASE_URL is not set or has an unrecognized scheme.'
  }

  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: {
      provider,
      persistenceLikely,
      persistenceVerdict,
      writeTest,
      writeTestDetail,
      urlScheme: dbUrl ? dbUrl.split('://')[0] : 'unset',
      recordCounts,
    },
    ai: {
      deepseek: {
        configured: deepseekConfigured,
        model: 'deepseek-chat (DeepSeek-V3)',
        powers: 'AI Coach chat completions + smart-sync memory extraction',
      },
      openai: {
        configured: openaiConfigured,
        powers: 'Whisper ASR, TTS, DALL-E (optional)',
      },
      note: 'ZAI_API_KEY/ZAI_TOKEN are not used. The "ZAI" names in source are legacy wrappers.',
    },
    warnings,
  })
}
