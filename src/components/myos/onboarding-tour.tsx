'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, LayoutDashboard, Compass, MessageCircle, PartyPopper } from 'lucide-react'

const TOUR_STEPS = [
  {
    title: "Welcome to MyOS",
    description: "Your personal life operating system. Let me show you around.",
    icon: Sparkles,
    target: null,
  },
  {
    title: "Check-in Dashboard",
    description: "This is your home base. Log your mood, track check-ins, and see your life overview at a glance.",
    icon: LayoutDashboard,
    target: 'dashboard',
  },
  {
    title: "Life Areas",
    description: "Track 7 areas of your life \u2014 Faith, Health, Career, Havilah, Finances, Relationships, and Personal Growth.",
    icon: Compass,
    target: 'life',
  },
  {
    title: "AI Coach",
    description: "Talk to your AI coach anytime. It learns from your patterns and holds you accountable.",
    icon: MessageCircle,
    target: 'chat',
  },
  {
    title: "You're All Set",
    description: "Start by logging your first check-in or setting a goal. MyOS gets smarter the more you use it.",
    icon: PartyPopper,
    target: null,
  },
]

const STORAGE_KEY = 'myos-onboarding-complete'

function getInitialVisible(): boolean {
  if (typeof window === 'undefined') return false
  return !localStorage.getItem(STORAGE_KEY)
}

export function OnboardingTour() {
  const [visible, setVisible] = useState(getInitialVisible)
  const [step, setStep] = useState(0)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const handleNext = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1)
    } else {
      handleFinish()
    }
  }

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1)
    }
  }

  const handleSkip = () => {
    handleFinish()
  }

  const handleFinish = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
    setVisible(false)
  }

  if (!visible) return null

  const currentStep = TOUR_STEPS[step]
  const Icon = currentStep.icon
  const isFirst = step === 0
  const isLast = step === TOUR_STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleSkip} />

      {/* Modal */}
      <div className="relative z-10 w-[90vw] max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-300">
        {/* Step content */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center mb-4">
            <Icon className="h-7 w-7 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            {currentStep.title}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {currentStep.description}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-5">
          {TOUR_STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                i === step
                  ? 'w-6 bg-red-600 dark:bg-red-400'
                  : i < step
                    ? 'bg-red-300 dark:bg-red-800'
                    : 'bg-neutral-200 dark:bg-neutral-700'
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {!isLast && (
              <button
                onClick={handleSkip}
                className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              >
                Skip
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={handleBack}
              >
                Back
              </Button>
            )}
            <Button
              size="sm"
              className="text-xs h-8 bg-red-600 hover:bg-red-700 text-white"
              onClick={handleNext}
            >
              {isLast ? "Let's Go!" : 'Next'}
            </Button>
          </div>
        </div>

        {/* Don't show again */}
        <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
          <button
            onClick={() => setDontShowAgain(!dontShowAgain)}
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
              dontShowAgain
                ? 'bg-red-600 border-red-600'
                : 'border-neutral-300 dark:border-neutral-600'
            }`}
          >
            {dontShowAgain && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500">Don&apos;t show again</span>
        </div>
      </div>
    </div>
  )
}
