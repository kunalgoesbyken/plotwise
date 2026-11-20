import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { DEFAULT_REGION } from '@/region/regions'
import { SHARE_PALETTE, SITE_ORIGIN } from '@/seo/identity'
import { pageMetadata } from '@/seo/metadata'
import { t } from '@/text/messages'
import './globals.css'

const sans = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN.value),
  ...pageMetadata({
    title: t('landing.title', { city: DEFAULT_REGION.city }),
    description: t('landing.description', { city: DEFAULT_REGION.city }),
    path: '/',
  }),
}

export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: SHARE_PALETTE.value.canvas,
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  )
}
