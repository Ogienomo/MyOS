'use client'

import { LifeAreaPage } from '@/components/myos/life-area-page'
import { AREA_CONFIGS } from './area-configs'

export function RelationshipsPage() {
  return <LifeAreaPage config={AREA_CONFIGS.relationships} />
}
