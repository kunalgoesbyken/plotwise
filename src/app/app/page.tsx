import type { Metadata } from 'next'
import { FeasibilityApp } from '@/feasibility/feasibility-app'
import { REGION } from '@/region/regions'
import { pageMetadata } from '@/seo/metadata'
import { t } from '@/text/messages'

export const metadata: Metadata = pageMetadata({
  title: t('app.title', { city: REGION.city }),
  description: t('app.description', { city: REGION.city }),
  path: '/app',
})

export default function Workspace() {
  return <FeasibilityApp />
}
