import { NextResponse } from 'next/server'
import { callZAI, getZAIStatus, isZAIConfigured } from '@/lib/ai'

/**
 * GET /api/ai-test
 * Actually calls the z.ai API to verify it works on Vercel.
 * Returns the AI response + diagnostic info.
 */
export async function GET() {
  const status = getZAIStatus()

  if (!status.configured) {
    return NextResponse.json({
      success: false,
      error: status.message,
      details: status.details,
      hint: 'Add the missing env vars in Vercel project settings, then REDPLOY.',
      envCheck: {
        ZAI_API_KEY_set: !!process.env.ZAI_API_KEY,
        ZAI_TOKEN_set: !!process.env.ZAI_TOKEN,
        ZAI_CHAT_ID_set: !!process.env.ZAI_CHAT_ID,
        ZAI_USER_ID_set: !!process.env.ZAI_USER_ID,
        ZAI_BASE_URL: process.env.ZAI_BASE_URL || '(not set, using default)',
      },
    })
  }

  // Actually call the AI
  try {
    const response = await callZAI({
      messages: [
        { role: 'system', content: 'You are MyOS. Respond in one sentence.' },
        { role: 'user', content: 'Say hello and confirm you are the real AI, not a fallback.' },
      ],
      stream: false,
    })

    const aiContent = response?.choices?.[0]?.message?.content || 'No content in response'

    return NextResponse.json({
      success: true,
      aiResponse: aiContent,
      model: response?.model || 'unknown',
      tokens: response?.usage?.total_tokens || 0,
      configured: true,
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({
      success: false,
      error: errMsg,
      configured: status.configured,
      details: status.details,
      hint: 'The API call failed. Check the error message above.',
    }, { status: 500 })
  }
}
