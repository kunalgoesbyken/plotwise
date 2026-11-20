import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { REGION } from '@/region/regions'
import './globals.css'

const sans = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: `Plotwise · ${REGION.city} plot feasibility`,
  description: `Draw a ${REGION.city} plot, mark its roads and see what you can build on it, in 3D.`,
}

export const viewport: Viewport = {
  themeColor: '#eef2f1',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  )
}
