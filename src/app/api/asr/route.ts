import { NextRequest, NextResponse } from 'next/server'
import { getZAI } from '@/lib/ai'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const MAX_AUDIO_BASE64_BYTES = 15 * 1024 * 1024 // 15 MB base64 ≈ ~11 MB audio

// POST /api/asr - Transcribe audio using ZAI ASR
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const rl = rateLimit(`asr:${ip}`, 20, 60_000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many voice requests. Please wait a moment.' }, { status: 429 })
    }

    const body = await request.json()
    const { audio_base64 } = body

    if (!audio_base64 || typeof audio_base64 !== 'string') {
      return NextResponse.json({ error: 'Audio base64 data is required' }, { status: 400 })
    }

    if (audio_base64.length > MAX_AUDIO_BASE64_BYTES) {
      return NextResponse.json({ error: 'Audio file too large. Maximum size is ~10 MB.' }, { status: 413 })
    }

    const zai = await getZAI()

    const response = await zai.audio.asr.create({
      file_base64: audio_base64,
    })

    const transcription = response.text || ''

    if (!transcription || transcription.trim().length === 0) {
      return NextResponse.json({
        success: false,
        transcription: '',
        error: 'Could not transcribe audio. Please try again with clearer audio or type your message.',
      })
    }

    return NextResponse.json({
      success: true,
      transcription,
      wordCount: transcription.split(/\s+/).filter(Boolean).length,
    })
  } catch (error) {
    console.error('ASR API error:', error)
    return NextResponse.json({
      success: false,
      transcription: '',
      error: 'Voice transcription is currently unavailable. Please type your message instead.',
    }, { status: 500 })
  }
}
