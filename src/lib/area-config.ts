/**
 * MyOS — Life Area Configuration
 * Centralized colors, labels, and icons for all 7 life areas.
 * Import this instead of hard-coding area labels/colors everywhere.
 */

export const AREA_CONFIG: Record<string, {
  label: string
  color: string          // Tailwind bg + text classes for badges/pills
  accent: string         // Tailwind color name for dynamic usage
  bgColor: string        // Tailwind bg class for cards/sections
  borderColor: string    // Tailwind border class
  icon: string           // Lucide icon name (for reference)
}> = {
  faith: {
    label: 'Faith',
    color: 'bg-violet-100 text-violet-700',
    accent: 'violet',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    icon: 'Heart',
  },
  health: {
    label: 'Health',
    color: 'bg-emerald-100 text-emerald-700',
    accent: 'emerald',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    icon: 'Activity',
  },
  career: {
    label: 'Career',
    color: 'bg-sky-100 text-sky-700',
    accent: 'sky',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    icon: 'Briefcase',
  },
  havilah: {
    label: 'Havilah',
    color: 'bg-amber-100 text-amber-700',
    accent: 'amber',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: 'Flame',
  },
  finances: {
    label: 'Finances',
    color: 'bg-teal-100 text-teal-700',
    accent: 'teal',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    icon: 'Wallet',
  },
  relationships: {
    label: 'Relationships',
    color: 'bg-pink-100 text-pink-700',
    accent: 'pink',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    icon: 'Users',
  },
  personalGrowth: {
    label: 'Growth',
    color: 'bg-orange-100 text-orange-700',
    accent: 'orange',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: 'TrendingUp',
  },
}

/** Get area config with fallback for unknown areas */
export function getAreaConfig(area: string) {
  return AREA_CONFIG[area] || {
    label: area.charAt(0).toUpperCase() + area.slice(1),
    color: 'bg-neutral-100 text-neutral-700',
    accent: 'neutral',
    bgColor: 'bg-neutral-50',
    borderColor: 'border-neutral-200',
    icon: 'Circle',
  }
}

/** All area keys for iteration */
export const AREA_KEYS = Object.keys(AREA_CONFIG)
