#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# vercel-build.sh — Smart build script for MyOS on Vercel
#
# This script runs INSTEAD OF the default `next build` (configured via
# vercel.json). It ensures the Prisma database provider matches the
# DATABASE_URL environment variable before building Next.js.
#
# WHY THIS EXISTS:
#   Prisma's `provider` field must be a literal at build time, but we want
#   ONE codebase that works for both local dev (SQLite) and Vercel
#   production (PostgreSQL). This script detects which database to use
#   based on DATABASE_URL and patches the schema accordingly.
#
# REQUIRED VERCEL ENV VARS:
#   DATABASE_URL     — A PostgreSQL connection string (e.g. Neon)
#                      Example: postgresql://user:pass@ep-xxx.neon.tech/praise_os?sslmode=require
#   OPENAI_API_KEY   — Your OpenAI API key (powers the AI Coach)
#
# IF DATABASE_URL IS NOT SET OR IS A FILE: URL:
#   The build falls back to SQLite so local development continues to work,
#   but a WARNING is printed — SQLite on Vercel serverless does NOT persist
#   data between requests.
# ─────────────────────────────────────────────────────────────────────────────
set -e

DB_URL="${DATABASE_URL:-}"
SCHEMA="prisma/schema.prisma"

echo "=========================================="
echo "  MyOS — Vercel Build"
echo "=========================================="
echo ""

# ── 1. Detect database type from DATABASE_URL ──────────────────────────────
USE_POSTGRES=false
if [[ "$DB_URL" == postgresql://* ]] || [[ "$DB_URL" == postgres://* ]]; then
  USE_POSTGRES=true
  echo "📦 DATABASE_URL detected: PostgreSQL"
else
  echo "📦 DATABASE_URL detected: SQLite (or unset) — local dev mode"
  if [[ -z "$DB_URL" ]]; then
    echo "   ⚠️  DATABASE_URL is NOT set."
  else
    echo "   DATABASE_URL = $DB_URL"
  fi
  echo "   ⚠️  WARNING: SQLite on Vercel serverless does NOT persist data."
  echo "      To enable persistence, set DATABASE_URL to a PostgreSQL"
  echo "      connection string (Neon, Supabase, etc.) in your Vercel"
  echo "      project settings → Environment Variables."
fi
echo ""

# ── 2. Patch Prisma schema if PostgreSQL is needed ─────────────────────────
if [ "$USE_POSTGRES" = true ]; then
  if grep -q 'provider = "sqlite"' "$SCHEMA"; then
    echo "🔧 Switching Prisma provider: sqlite → postgresql ..."
    sed -i 's/provider = "sqlite"/provider = "postgresql"/' "$SCHEMA"
  else
    echo "🔧 Prisma provider already postgresql — no switch needed."
  fi
else
  # Ensure SQLite for local dev (in case a previous build switched it)
  if grep -q 'provider = "postgresql"' "$SCHEMA"; then
    echo "🔧 Switching Prisma provider: postgresql → sqlite (local dev) ..."
    sed -i 's/provider = "postgresql"/provider = "sqlite"/' "$SCHEMA"
  fi
fi
echo ""

# ── 3. Generate Prisma Client for the chosen provider ──────────────────────
echo "📦 Generating Prisma Client ..."
npx prisma generate
echo ""

# ── 4. Push schema to database (PostgreSQL only — creates tables) ──────────
if [ "$USE_POSTGRES" = true ]; then
  echo "📦 Pushing schema to PostgreSQL database ..."
  npx prisma db push --accept-data-loss 2>&1 || {
    echo ""
    echo "❌ FAILED: prisma db push could not reach the database."
    echo "   Check that DATABASE_URL is a valid PostgreSQL connection string"
    echo "   and that the database is accessible from Vercel."
    echo "   DATABASE_URL starts with: ${DB_URL:0:40}..."
    exit 1
  }
  echo "✅ PostgreSQL schema pushed successfully."
else
  echo "📦 Pushing schema to local SQLite ..."
  npx prisma db push --accept-data-loss 2>&1 || true
fi
echo ""

# ── 5. Check AI providers ──────────────────────────────────────────────────
# The AI Coach is powered by DeepSeek-V3 (deepseek-chat) — fast,
# conversational, streams in 2–8s. OPENAI_API_KEY is optional — only needed
# for Whisper voice transcription, TTS, and DALL-E image generation.
echo "=========================================="
echo "  AI Provider Check"
echo "=========================================="
if [ -n "$DEEPSEEK_API_KEY" ]; then
  echo "🤖 DEEPSEEK_API_KEY is configured — AI Coach will use DeepSeek-V3 (deepseek-chat)."
else
  echo "⚠️  DEEPSEEK_API_KEY is NOT set."
  echo "   The AI Coach will fall back to the built-in intelligent coaching"
  echo "   engine (no LLM calls). To enable full AI, add DEEPSEEK_API_KEY in"
  echo "   your Vercel project settings → Environment Variables."
  echo "   Get a key at https://platform.deepseek.com/api_keys"
fi
echo ""
if [ -n "$OPENAI_API_KEY" ]; then
  echo "🎤 OPENAI_API_KEY is configured — voice transcription & TTS available."
else
  echo "ℹ️  OPENAI_API_KEY is NOT set (optional)."
  echo "   Voice transcription, TTS, and image generation need this key."
  echo "   The rest of the app works without it."
fi
echo ""
echo "   NOTE: ZAI_API_KEY / ZAI_TOKEN are NOT used by this codebase."
echo "   The 'ZAI' names in the source are legacy backward-compat wrappers."

# ── 6. Build Next.js ───────────────────────────────────────────────────────
echo "=========================================="
echo "  Building Next.js"
echo "=========================================="
next build
echo ""

echo "=========================================="
echo "  ✅ Build complete!"
echo "=========================================="
if [ "$USE_POSTGRES" = true ]; then
  echo "  Database: PostgreSQL (data WILL persist) ✅"
else
  echo "  Database: SQLite (data will NOT persist on Vercel) ⚠️"
fi
if [ -n "$DEEPSEEK_API_KEY" ]; then
  echo "  AI Chat:  DeepSeek-V3 (deepseek-chat) ✅"
else
  echo "  AI Chat:  Fallback coaching engine (no LLM) ⚠️"
fi
if [ -n "$OPENAI_API_KEY" ]; then
  echo "  Voice/TTS: OpenAI Whisper ✅"
else
  echo "  Voice/TTS: Not configured (optional) ℹ️"
fi
echo "=========================================="
