import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── TIMEZONE-AWARE DATE UTILITIES ─────────────────────────────
// The app's user is in Africa/Lagos (UTC+1).
// Using UTC dates (toISOString) causes a mismatch during the
// midnight–1 AM window when the UTC date has already rolled over
// but the local date has not. These utilities ensure all date
// comparisons use the user's local date.

const USER_TIMEZONE = 'Africa/Lagos'

/**
 * Returns today's date string (YYYY-MM-DD) in the user's timezone.
 * Replaces `new Date().toISOString().split('T')[0]` for any code
 * that needs to compare against user-local dates.
 */
export function getTodayInTimezone(tz: string = USER_TIMEZONE): string {
  return formatDateInTimezone(new Date(), tz)
}

/**
 * Formats a Date (or timestamp) as YYYY-MM-DD in the given timezone.
 */
export function formatDateInTimezone(date: Date | string | number, tz: string = USER_TIMEZONE): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  // Use Intl to get the calendar date parts in the target timezone
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const year = parts.find(p => p.type === 'year')!.value
  const month = parts.find(p => p.type === 'month')!.value
  const day = parts.find(p => p.type === 'day')!.value
  return `${year}-${month}-${day}`
}

/**
 * Returns the date string for N days before today in the user's timezone.
 * Useful for streak back-walking.
 */
export function subtractDaysInTimezone(days: number, tz: string = USER_TIMEZONE): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return formatDateInTimezone(d, tz)
}

/**
 * Returns the current hour (0-23) in the user's timezone.
 * Use this instead of `new Date().getHours()` which returns server-local time
 * (often UTC in production), causing time-of-day logic to be off by the
 * timezone offset.
 */
export function getCurrentHourInTimezone(tz: string = USER_TIMEZONE): number {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    hour12: false,
  }).format(new Date())
  return parseInt(hourStr, 10) % 24
}

/**
 * Returns the current time as a formatted string (e.g. "11:50 PM") in the
 * user's timezone.
 */
export function getCurrentTimeStringInTimezone(tz: string = USER_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date())
}

/**
 * Returns the current minute-of-day (0-1439) in the user's timezone.
 */
export function getCurrentMinutesInTimezone(tz: string = USER_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const h = parseInt(parts.find(p => p.type === 'hour')!.value, 10) % 24
  const m = parseInt(parts.find(p => p.type === 'minute')!.value, 10)
  return h * 60 + m
}
