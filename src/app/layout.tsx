import type { Metadata, Viewport } from 'next'
import { Anuphan, Bai_Jamjuree, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

const display = Bai_Jamjuree({
  variable: '--font-bai-jamjuree',
  subsets: ['latin', 'thai'],
  weight: ['500', '600'],
})

const body = Anuphan({
  variable: '--font-anuphan',
  subsets: ['latin', 'thai'],
})

const mono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'Plotwise · Bangkok plot feasibility',
  description: 'Draw a Bangkok plot, mark its roads and see what you can build on it, in 3D.',
}

export const viewport: Viewport = {
  themeColor: '#eef2f1',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
