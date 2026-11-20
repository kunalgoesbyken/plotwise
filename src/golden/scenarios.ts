import type { Vec2 } from '@/geo/projection'
import { BUILDING_TYPES, type BuildingType, type Plot, type Road } from '@/plot/plot'
import { EXAMPLE_PLOT } from '@/plot/example-plot'
import type { FarMode } from '@/solve'
import { plotFromMetres, rectangle } from '@/solve/test-plots'

const E2E_PLOT: Plot = {
  ring: [
    [100.5686, 13.7648],
    [100.56915, 13.7648],
    [100.5692, 13.76525],
    [100.5689, 13.7655],
    [100.5686, 13.76545],
  ],
  roads: [{ edge: 0, widthM: 30 }],
  buildingType: 'condo',
  nearStation: false,
}

const L_SHAPE: Vec2[] = [
  [0, 0],
  [60, 0],
  [60, 25],
  [25, 25],
  [25, 60],
  [0, 60],
]

type Layout = {
  readonly name: string
  readonly points: readonly Vec2[]
  readonly roads: readonly Road[]
  readonly nearStation?: boolean
}

const LAYOUTS: readonly Layout[] = [
  { name: 'typical 50x70 on a 16 m road', points: rectangle(50, 70), roads: [{ edge: 0, widthM: 16 }] },
  { name: 'concave L-shape on a 12 m road', points: L_SHAPE, roads: [{ edge: 0, widthM: 12 }] },
  { name: 'narrow deep 12x80 on an 8 m road', points: rectangle(12, 80), roads: [{ edge: 0, widthM: 8 }] },
  {
    name: 'corner 40x60 on 16 m and 8 m roads',
    points: rectangle(40, 60),
    roads: [
      { edge: 0, widthM: 16 },
      { edge: 1, widthM: 8 },
    ],
  },
  {
    name: 'large 120x150 on 24 m and 12 m roads',
    points: rectangle(120, 150),
    roads: [
      { edge: 0, widthM: 24 },
      { edge: 2, widthM: 12 },
    ],
  },
  { name: 'small 15x20 on a 6 m road', points: rectangle(15, 20), roads: [{ edge: 0, widthM: 6 }] },
  { name: 'wide road 40x50 on a 30 m road', points: rectangle(40, 50), roads: [{ edge: 0, widthM: 30 }] },
  { name: 'near a station 60x80 on a 10 m road', points: rectangle(60, 80), roads: [{ edge: 0, widthM: 10 }], nearStation: true },
]

export type Scenario = { readonly name: string; readonly plot: Plot; readonly farMode: FarMode }

const FAR_MODES: readonly FarMode[] = ['standard', 'bonus']

const withType = (plot: Plot, buildingType: BuildingType): Plot => ({ ...plot, buildingType })

const layoutScenarios = LAYOUTS.flatMap(({ name, points, roads, nearStation }) =>
  BUILDING_TYPES.flatMap((type) =>
    FAR_MODES.map((farMode) => ({
      name: `${name}, ${type}, FAR ${farMode}`,
      plot: plotFromMetres(points, roads, type, nearStation),
      farMode,
    })),
  ),
)

const drawnScenarios = [
  { name: 'example plot', plot: EXAMPLE_PLOT },
  { name: 'e2e plot', plot: E2E_PLOT },
].flatMap(({ name, plot }) =>
  BUILDING_TYPES.flatMap((type) => FAR_MODES.map((farMode) => ({ name: `${name}, ${type}, FAR ${farMode}`, plot: withType(plot, type), farMode }))),
)

export const SCENARIOS: readonly Scenario[] = [...drawnScenarios, ...layoutScenarios]
