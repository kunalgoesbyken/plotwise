import type { Metadata } from 'next'
import { FeasibilityApp } from '@/feasibility/feasibility-app'
import { DEFAULT_REGION } from '@/region/regions'
import { pageMetadata } from '@/seo/metadata'
import { t } from '@/text/messages'

export const metadata: Metadata = pageMetadata({
  title: t('app.title'),
  description: t('app.description', { city: DEFAULT_REGION.name }),
  path: '/app',
})

export default function Workspace() {
  return <FeasibilityApp />
}
