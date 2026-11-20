import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { REGION } from '@/region/regions'
import { t } from '@/text/messages'
import './globals.css'

const sans = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: t('landing.title', { city: REGION.city }),
  description: t('landing.description', { city: REGION.city }),
}

export const viewport: Viewport = {
  viewportFit: 'cover',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  )
}
