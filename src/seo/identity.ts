import type { Assumption } from '@/site/assumptions'

export const SITE_ORIGIN: Assumption<string> = {
  value: 'https://plotwise-ashy.vercel.app',
  source: 'the live deployment named in README.md; canonical, sitemap and share-card URLs resolve against it',
}

export const SHARE_PALETTE: Assumption<Readonly<Record<'canvas' | 'card' | 'border' | 'ink' | 'muted' | 'plot' | 'road', string>>> = {
  value: { canvas: '#f7f6f3', card: '#ffffff', border: '#ebebeb', ink: '#171717', muted: '#666666', plot: '#2f5bea', road: '#f0a92a' },
  source:
    'design tokens --color-canvas, --color-background, --color-border, --color-foreground, --color-muted-foreground, --color-plot and --color-road in src/app/globals.css; identity.test.ts fails when they drift apart',
}
