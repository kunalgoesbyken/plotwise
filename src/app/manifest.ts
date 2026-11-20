import type { MetadataRoute } from 'next'
import { DEFAULT_REGION } from '@/region/regions'
import { SHARE_PALETTE } from '@/seo/identity'
import { t } from '@/text/messages'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: t('app.name'),
    short_name: t('app.name'),
    description: t('landing.description', { city: DEFAULT_REGION.name }),
    start_url: '/app',
    display: 'standalone',
    background_color: SHARE_PALETTE.value.canvas,
    theme_color: SHARE_PALETTE.value.canvas,
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
