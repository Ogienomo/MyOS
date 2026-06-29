'use client'

import { useMemo } from 'react'
import { LifeAreaPage } from '@/components/praise-os/life-area-page'
import { buildAreaConfigs } from './area-configs'
import { useAppStore } from '@/lib/store'

export function HavilahPage() {
  const { businessName, businessDescription } = useAppStore()
  const configs = useMemo(() => buildAreaConfigs(
    businessName || undefined,
    businessDescription || undefined,
  ), [businessName, businessDescription])

  return <LifeAreaPage config={configs.havilah} />
}
