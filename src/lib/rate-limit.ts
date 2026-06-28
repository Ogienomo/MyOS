interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

/** Clean up entries older than 10 minutes every 5 minutes */
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetIn: number
}

/**
 * Simple in-memory rate limiter.
 * @param key      Unique key (e.g. IP + route)
 * @param limit    Max requests in the window
 * @param windowMs Window duration in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetIn: windowMs }
  }

  entry.count++
  const remaining = Math.max(0, limit - entry.count)
  const resetIn = entry.resetAt - now

  return { allowed: entry.count <= limit, remaining, resetIn }
}

/** Extract the client IP from a Next.js request for use as a rate-limit key */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}
