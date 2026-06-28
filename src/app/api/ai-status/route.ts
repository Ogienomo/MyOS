import { NextResponse } from 'next/server'
import { getZAIStatus } from '@/lib/ai'

/**
 * GET /api/ai-status
 * Diagnostic endpoint to check if ZAI is properly configured.
 * Shows which env vars are set and the resolved API mode (internal vs public).
 */
export async function GET() {
  const status = getZAIStatus()
  return NextResponse.json({
    configured: status.configured,
    message: status.message,
    details: status.details,
    timestamp: new Date().toISOString(),
  })
}
