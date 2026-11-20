import type { MetadataRoute } from 'next'
import { SITE_ORIGIN } from '@/seo/identity'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: `${SITE_ORIGIN.value}/sitemap.xml`,
  }
}
