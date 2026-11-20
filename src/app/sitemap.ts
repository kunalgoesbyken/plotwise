import type { MetadataRoute } from 'next'
import { SITE_ORIGIN } from '@/seo/identity'

const PAGES = ['/', '/app'] as const

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({ url: new URL(path, SITE_ORIGIN.value).href }))
}
