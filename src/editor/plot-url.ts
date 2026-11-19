import { PlotSchema, type Plot } from '@/plot/plot'

const LIST = ';'
const PAIR = ','
const ROAD = ':'
const STATION = '1'

function strictNumber(text: string) {
  return text.trim() === '' ? Number.NaN : Number(text)
}

function numbers(text: string, separator: string) {
  return text.split(separator).map(strictNumber)
}

export function encodePlot(plot: Plot) {
  const ring = plot.ring.map((p) => p.join(PAIR)).join(LIST)
  const roads = plot.roads.map((r) => `${r.edge}${ROAD}${r.widthM}`).join(LIST)
  const station = plot.nearStation ? `&station=${STATION}` : ''
  return `plot=${ring}&roads=${roads}&type=${plot.buildingType}${station}`
}

export function decodePlot(fragment: string): Plot | null {
  const params = new URLSearchParams(fragment.replace(/^#/, ''))
  const ring = params.get('plot')
  const roads = params.get('roads')
  const buildingType = params.get('type')
  const station = params.get('station')
  if (ring === null || roads === null || buildingType === null) return null
  if (station !== null && station !== STATION) return null
  const parsed = PlotSchema.safeParse({
    ring: ring.split(LIST).map((p) => numbers(p, PAIR)),
    roads: roads.split(LIST).map((r) => {
      const [edge, widthM] = numbers(r, ROAD)
      return { edge, widthM }
    }),
    buildingType,
    nearStation: station === STATION,
  })
  return parsed.success ? parsed.data : null
}
