'use client'

import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  Heart,
  Activity,
  Briefcase,
  Gem,
  Wallet,
  Users,
  Sprout,
  Sun,
  Clock,
  Moon,
  TrendingUp,
  Compass,
  Star,
  Quote,
  Target,
  BarChart3,
  Zap,
} from 'lucide-react'

const coreValues = [
  { label: 'Purpose' },
  { label: 'Stewardship' },
  { label: 'Growth' },
  { label: 'Excellence' },
  { label: 'Integrity' },
  { label: 'Discipline' },
  { label: 'Service' },
  { label: 'Joy' },
]

const lifeAreas = [
  { label: 'Faith', desc: 'Prayer, scripture, devotion, spiritual growth', icon: <Heart className="h-4 w-4 text-red-500" /> },
  { label: 'Health', desc: 'Sleep, food, movement, gym, energy, rest', icon: <Activity className="h-4 w-4 text-rose-500" /> },
  { label: 'Career', desc: 'Applications, skills, CV, interviews, professional growth', icon: <Briefcase className="h-4 w-4 text-red-600" /> },
  { label: 'Havilah', desc: 'Business, ventures, revenue, clients, systems', icon: <Gem className="h-4 w-4 text-rose-600" /> },
  { label: 'Finances', desc: 'Money tracking, savings, giving, budgeting, stewardship', icon: <Wallet className="h-4 w-4 text-red-500" /> },
  { label: 'Relationships', desc: 'Family, friends, community, mentorship', icon: <Users className="h-4 w-4 text-rose-500" /> },
  { label: 'Personal Growth', desc: 'Learning, reading, journaling, reflection, discipline', icon: <Sprout className="h-4 w-4 text-red-700" /> },
]

const cadence = [
  { label: 'Morning Alignment', time: 'Configurable', desc: 'Set the day with intention. Schedule, feelings, priorities.', icon: <Sun className="h-4 w-4 text-red-500" /> },
  { label: 'Midday Correction', time: '12:00 PM', desc: 'Reset focus. Completed, blockers, what\'s slipping.', icon: <Clock className="h-4 w-4 text-red-600" /> },
  { label: 'Evening Review', time: 'Configurable', desc: 'Close the day with honesty. Wins, lessons, drift.', icon: <Moon className="h-4 w-4 text-rose-500" /> },
  { label: 'Friday Strategic Review', time: '4:30 PM', desc: 'Serious weekly review across all life areas.', icon: <TrendingUp className="h-4 w-4 text-red-600" /> },
  { label: 'Sunday Planning', time: '6:00 PM', desc: 'Review upcoming week. Priorities, deadlines, focus blocks.', icon: <Compass className="h-4 w-4 text-rose-600" /> },
]

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
}

export function About() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-black via-neutral-900 to-red-950/40 p-8 md:p-12"
      >
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-red-400/5 rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="shrink-0 mb-6"
          >
            <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 border-red-500/30 shadow-xl shadow-red-500/10 bg-red-600/15 flex items-center justify-center">
              <Sparkles className="h-12 w-12 text-red-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-red-400" />
              <span className="text-red-400 text-xs font-semibold uppercase tracking-wider">Your Personal OS</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Your Life Operating System</h1>
            <p className="text-neutral-300 text-sm md:text-base max-w-lg leading-relaxed">
              A person of purpose, discipline, and vision. Built to help you make thousands of small decisions
              that align with your deepest values until the life you want becomes the life you are actually living.
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* Core Values */}
      <motion.div {...fadeUp} transition={{ delay: 0.3 }}>
        <Card className="shadow-sm border-neutral-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Star className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-medium text-neutral-800">Core Values</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {coreValues.map((value, i) => (
                <motion.div
                  key={value.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                >
                  <Badge variant="secondary" className="text-sm py-1.5 px-3 bg-neutral-50 text-neutral-700 border border-neutral-200 hover:bg-neutral-100">
                    {value.label}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* MyOS Mission */}
      <motion.div {...fadeUp} transition={{ delay: 0.4 }}>
        <Card className="shadow-sm border-neutral-200 bg-gradient-to-br from-neutral-50/80 to-red-50/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-medium text-neutral-800">The MyOS Mission</h2>
            </div>
            <p className="text-sm text-neutral-600 leading-relaxed mb-4">
              This is your personal operating system — your chief of staff, accountability partner, and strategic advisor.
              Built to help you make thousands of small decisions that align with your deepest values until the life you want
              becomes the life you are actually living.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: <Target className="h-5 w-5 text-red-500" />, label: 'Accountability Partner', desc: 'Keeps you honest and aligned' },
                { icon: <BarChart3 className="h-5 w-5 text-red-500" />, label: 'Strategic Advisor', desc: 'Analyzes patterns and surfaces insights' },
                { icon: <Zap className="h-5 w-5 text-red-500" />, label: 'Chief of Staff', desc: 'Manages your daily operating cadence' },
              ].map((item) => (
                <div key={item.label} className="p-3 bg-white/60 rounded-xl border border-neutral-100">
                  {item.icon}
                  <p className="text-xs font-medium text-neutral-700 mt-1">{item.label}</p>
                  <p className="text-[10px] text-neutral-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 7 Life Areas */}
      <motion.div {...fadeUp} transition={{ delay: 0.5 }}>
        <div className="flex items-center gap-2 mb-4">
          <Heart className="h-5 w-5 text-red-500" />
          <h2 className="text-lg font-medium text-neutral-800">7 Life Areas</h2>
        </div>
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {lifeAreas.map((area, i) => (
            <motion.div
              key={area.label}
              variants={fadeUp}
              transition={{ delay: 0.5 + i * 0.05 }}
            >
              <Card className="shadow-sm border border-neutral-200 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-neutral-50 flex items-center justify-center shrink-0">
                      {area.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-neutral-800">{area.label}</h3>
                      <p className="text-xs text-neutral-500 mt-0.5">{area.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Operating Cadence */}
      <motion.div {...fadeUp} transition={{ delay: 0.6 }}>
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-medium text-neutral-800">Operating Cadence</h2>
            </div>
            <div className="space-y-3">
              {cadence.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.08 }}
                  className="flex items-center gap-4 p-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-neutral-800">{item.label}</span>
                    <p className="text-xs text-neutral-500 mt-0.5">{item.desc}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0 whitespace-nowrap">{item.time}</Badge>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Footer Quote */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="text-center py-4"
      >
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-neutral-50 to-red-50/30 border border-neutral-200">
          <Quote className="h-4 w-4 text-neutral-400" />
          <p className="text-sm font-medium text-neutral-600 italic">
            The life you want becomes the life you are actually living.
          </p>
        </div>
        <p className="text-[10px] text-neutral-400 mt-3">
          MyOS &bull; Built with intention &bull; Aligned &bull; Disciplined &bull; Joyful
        </p>
      </motion.div>
    </div>
  )
}
