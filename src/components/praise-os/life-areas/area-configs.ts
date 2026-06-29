import { Heart, Activity, Briefcase, Building2, Wallet, Users, Sprout } from 'lucide-react'
import { AreaConfig } from '@/components/praise-os/life-area-page'

/**
 * Get the dynamic business area label.
 * If a business name is set, use it; otherwise default to "Business".
 * Also stored in localStorage for client-side access.
 */
export function getBusinessLabel(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('myos-business-name')
      if (stored && stored.trim()) return stored.trim()
    } catch {}
  }
  return 'Business'
}

export function getBusinessDescription(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('myos-business-description')
      if (stored && stored.trim()) return stored.trim()
    } catch {}
  }
  return 'Revenue, clients, systems, growth'
}

/**
 * Build AREA_CONFIGS with dynamic business name/description.
 * Call this when business profile changes to refresh configs.
 */
export function buildAreaConfigs(businessName?: string, businessDescription?: string): Record<string, AreaConfig> {
  const bName = businessName || 'Business'
  const bDesc = businessDescription || 'Revenue, clients, systems, growth'

  return {
    faith: {
      id: 'faith',
      label: 'Faith',
      emoji: '',
      icon: Heart,
      color: 'red',
      gradient: 'from-red-50 to-rose-50',
      accentColor: 'bg-red-600',
      description: 'Prayer, scripture, devotion, obedience, spiritual growth',
      idealVision: "Grow deeper in relationship with God through consistent prayer, scripture study, devotion, and obedience. Be a woman of faith whose life reflects God's glory.",
      promptPrefix: 'You are the Faith Coach for MyOS. Help you grow spiritually through prayer, scripture, and devotion.',
    },
    health: {
      id: 'health',
      label: 'Health',
      emoji: '',
      icon: Activity,
      color: 'rose',
      gradient: 'from-rose-50 to-red-50',
      accentColor: 'bg-rose-500',
      description: 'Sleep, food, movement, gym, energy, rest',
      idealVision: 'Achieve sustainable health through regular exercise (gym 3x/week), better nutrition, consistent sleep schedule (10PM-5AM), and maintaining energy.',
      promptPrefix: 'You are the Health Coach for MyOS. Help build sustainable health habits.',
    },
    career: {
      id: 'career',
      label: 'Career',
      emoji: '',
      icon: Briefcase,
      color: 'red',
      gradient: 'from-red-50 to-neutral-50',
      accentColor: 'bg-red-700',
      description: 'Applications, skills, CV, interviews, professional growth',
      idealVision: 'Secure an international corporate role (preferably remote/hybrid) in research/strategy. Build professional portfolio, network strategically.',
      promptPrefix: 'You are the Career Coach for MyOS. Help advance professionally and achieve career goals.',
    },
    havilah: {
      id: 'havilah',
      label: bName,
      emoji: '',
      icon: Building2,
      color: 'rose',
      gradient: 'from-rose-50 to-red-50',
      accentColor: 'bg-rose-600',
      description: bDesc,
      idealVision: `Build ${bName} into a thriving business with systems, clients, revenue, and sustainable growth.`,
      promptPrefix: `You are the ${bName} Business Coach for MyOS. Help build the business with focus on revenue and systems. Apply the Business Rule: Don't confuse activity with progress. Ask: Did this produce revenue, improve systems, or move a client forward?`,
    },
    finances: {
      id: 'finances',
      label: 'Finances',
      emoji: '',
      icon: Wallet,
      color: 'red',
      gradient: 'from-red-50 to-rose-50',
      accentColor: 'bg-red-500',
      description: 'Money tracking, savings, giving, budgeting, stewardship',
      idealVision: 'Become financially disciplined and aware. Track every naira. Build savings. Reduce wasteful spending. Align all spending with goals.',
      promptPrefix: 'You are the Finance Coach for MyOS. Apply the Finance Rule: Money must always be treated seriously. Track amount, source/category, purpose, whether aligned or wasteful.',
    },
    relationships: {
      id: 'relationships',
      label: 'Relationships',
      emoji: '',
      icon: Users,
      color: 'rose',
      gradient: 'from-rose-50 to-red-50',
      accentColor: 'bg-rose-400',
      description: 'Family, friends, church community, mentorship',
      idealVision: 'Deepen family bonds, build meaningful friendships, engage in church community, and seek/give mentorship. Be intentional about every relationship.',
      promptPrefix: 'You are the Relationships Coach for MyOS. Help build and maintain meaningful, intentional relationships.',
    },
    personalGrowth: {
      id: 'personalGrowth',
      label: 'Personal Growth',
      emoji: '',
      icon: Sprout,
      color: 'red',
      gradient: 'from-red-50 to-rose-50',
      accentColor: 'bg-red-800',
      description: 'Learning, reading, journaling, reflection, discipline, emotional maturity',
      idealVision: 'Commit to continuous learning - read 24+ books in 2026, journal consistently, develop emotional maturity, and grow in discipline and self-awareness.',
      promptPrefix: 'You are the Personal Growth Coach for MyOS. Become the best version of yourself through learning, reflection, and discipline.',
    },
  }
}

// Default static configs (used before business profile is loaded)
export const AREA_CONFIGS = buildAreaConfigs()
