import { ImageResponse } from 'next/og'
import { localFrame } from '@/geo/projection'
import { exampleFigures } from '@/landing/example'
import { EXAMPLE_PLOT } from '@/plot/example-plot'
import { DEFAULT_REGION } from '@/region/regions'
import { SHARE_PALETTE } from '@/seo/identity'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'

export const alt = t('share.image.alt', { city: DEFAULT_REGION.city })
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const CARD_PX = 380
const CARD_PADDING_PX = 56

function outlinePoints(ring: typeof EXAMPLE_PLOT.ring): [number, number][] {
  const frame = localFrame(ring[0])
  const local = ring.map(frame.toLocal)
  const xs = local.map(([x]) => x)
  const ys = local.map(([, y]) => y)
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)]
  const extent = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY)
  const scale = (CARD_PX - 2 * CARD_PADDING_PX) / extent
  return local.map(([x, y]) => [CARD_PADDING_PX + (x - minX) * scale, CARD_PX - CARD_PADDING_PX - (y - minY) * scale])
}

export default function Image() {
  const colours = SHARE_PALETTE.value
  const { plotSqm, allowedSqm } = exampleFigures()
  const points = outlinePoints(EXAMPLE_PLOT.ring)
  const roadEdges = EXAMPLE_PLOT.roads.map(({ edge }) => [points[edge], points[(edge + 1) % points.length]])

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'space-between', padding: 80, background: colours.canvas, color: colours.ink }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 640 }}>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em' }}>{t('app.name')}</div>
          <div style={{ marginTop: 40, fontSize: 78, fontWeight: 700, lineHeight: 1.04, letterSpacing: '-0.04em' }}>{t('landing.hero.title')}</div>
          <div style={{ marginTop: 40, fontSize: 30, color: colours.muted }}>
            {`${t('landing.frame.place')}: ${t('landing.frame.meta', { area: formatQuantity(plotSqm, 'sqm'), allowed: formatQuantity(allowedSqm, 'sqm') })}`}
          </div>
        </div>
        <div style={{ display: 'flex', width: CARD_PX, height: CARD_PX, background: colours.card, border: `2px solid ${colours.border}`, borderRadius: 32 }}>
          <svg width={CARD_PX - 4} height={CARD_PX - 4} viewBox={`0 0 ${CARD_PX} ${CARD_PX}`}>
            <polygon points={points.map((point) => point.join(',')).join(' ')} fill={colours.plot} fillOpacity={0.14} stroke={colours.plot} strokeWidth={5} strokeLinejoin="round" />
            {roadEdges.map(([from, to]) => (
              <line key={from.join(',')} x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={colours.road} strokeWidth={12} strokeLinecap="round" />
            ))}
          </svg>
        </div>
      </div>
    ),
    size,
  )
}
