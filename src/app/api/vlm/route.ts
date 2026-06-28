import { NextRequest, NextResponse } from 'next/server'
import { getZAI, PRAISE_OS_SYSTEM_PROMPT } from '@/lib/ai'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { sanitizeForAI } from '@/lib/validation'

const MAX_IMAGE_BASE64_BYTES = 20 * 1024 * 1024 // 20 MB base64 ≈ ~15 MB image

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const rl = rateLimit(`vlm:${ip}`, 10, 60_000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many image requests. Please wait a moment.' }, { status: 429 })
    }

    const body = await request.json()
    const { image_base64, prompt, checkInType } = body

    if (!image_base64 || typeof image_base64 !== 'string') {
      return NextResponse.json({ error: 'Image base64 data is required' }, { status: 400 })
    }

    if (image_base64.length > MAX_IMAGE_BASE64_BYTES) {
      return NextResponse.json({ error: 'Image too large. Maximum size is ~15 MB.' }, { status: 413 })
    }

    const zai = await getZAI()

    const analysisPrompt = prompt ? sanitizeForAI(prompt) : 'Analyze this image in the context of User\'s life goals and operating system. What does this image show? Extract any relevant information, text, or insights that could be useful for tracking progress, goals, or life areas.'

    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'system',
          content: PRAISE_OS_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: analysisPrompt },
            {
              type: 'image_url',
              image_url: {
                url: image_base64.startsWith('data:')
                  ? image_base64
                  : `data:image/jpeg;base64,${image_base64}`,
              },
            },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    })

    const analysis = response.choices?.[0]?.message?.content || 'I couldn\'t analyze this image. Please try again.'

    return NextResponse.json({
      success: true,
      analysis,
    })
  } catch (error) {
    console.error('VLM API error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze image' },
      { status: 500 }
    )
  }
}
