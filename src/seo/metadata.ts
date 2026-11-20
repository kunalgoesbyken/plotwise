import type { Metadata } from 'next'
import { t } from '@/text/messages'

type PageMetadata = { title: string; description: string; path: string }

export function pageMetadata({ title, description, path }: PageMetadata): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: t('app.name'), title, description, url: path },
    twitter: { card: 'summary_large_image', title, description },
  }
}
