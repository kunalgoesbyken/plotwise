'use client'

import { Line } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import type { Floor, Loop, Prism } from '@/geometry'
import type { ContextBuilding, ContextRoad } from './context'
import {
  buildingsGeometry,
  flatGeometry,
  layerSolids,
  ringEdges,
  roadRibbons,
  solidEdges,
  solidsGeometry,
  type BuildingTones,
  type Layer,
} from './meshes'
import type { Palette } from './palette'

const GROUND_SIZE_M = 8000
const PLOT_LINE_LIFT_M = 0.15

function useDisposal(resource: { dispose: () => void }) {
  useEffect(() => () => resource.dispose(), [resource])
}

function useLayers(layers: readonly Layer[]) {
  const solids = useMemo(() => layerSolids(layers), [layers])
  const geometry = useMemo(() => solidsGeometry(solids), [solids])
  const edges = useMemo(() => solidEdges(solids), [solids])
  useDisposal(geometry)
  return { geometry, edges }
}

export function Ground({ color }: { color: string }) {
  return (
    <mesh receiveShadow>
      <planeGeometry args={[GROUND_SIZE_M, GROUND_SIZE_M]} />
      <meshLambertMaterial color={color} />
    </mesh>
  )
}

export function Buildings({ buildings, tones }: { buildings: readonly ContextBuilding[]; tones: BuildingTones }) {
  const geometry = useMemo(() => buildingsGeometry(buildings, tones), [buildings, tones])
  useDisposal(geometry)
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshLambertMaterial vertexColors />
    </mesh>
  )
}

export function Roads({ roads, color }: { roads: readonly ContextRoad[]; color: string }) {
  const geometry = useMemo(() => flatGeometry(roadRibbons(roads)), [roads])
  useDisposal(geometry)
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshLambertMaterial color={color} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
    </mesh>
  )
}

type PlotMarksProps = { ring: Loop; roadEdges: readonly number[]; palette: Palette }

export function PlotMarks({ ring, roadEdges, palette }: PlotMarksProps) {
  const fill = useMemo(() => flatGeometry([{ outer: ring, holes: [] }]), [ring])
  const outline = useMemo(() => ringEdges(ring, ring.map((_, i) => i), PLOT_LINE_LIFT_M), [ring])
  const frontage = useMemo(() => ringEdges(ring, roadEdges, PLOT_LINE_LIFT_M), [ring, roadEdges])
  useDisposal(fill)
  return (
    <>
      <mesh geometry={fill}>
        <meshBasicMaterial
          color={palette.plot}
          transparent
          opacity={0.14}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <Line segments points={outline} color={palette.plot} lineWidth={2.5} />
      {frontage.length > 0 && <Line segments points={frontage} color={palette.road} lineWidth={5} />}
    </>
  )
}

type EnvelopeProps = { prisms: readonly Prism[]; color: string; faint?: boolean }

export function Envelope({ prisms, color, faint = false }: EnvelopeProps) {
  const { geometry, edges } = useLayers(prisms)
  if (prisms.length === 0) return null
  return (
    <>
      <mesh geometry={geometry}>
        <meshLambertMaterial color={color} transparent opacity={faint ? 0.07 : 0.16} depthWrite={false} />
      </mesh>
      <Line segments points={edges} color={color} lineWidth={faint ? 1 : 1.5} dashed={faint} dashSize={1.5} gapSize={1} transparent opacity={faint ? 0.7 : 1} />
    </>
  )
}

export function Massing({ floors, palette }: { floors: readonly Floor[]; palette: Palette }) {
  const { geometry, edges } = useLayers(floors)
  if (floors.length === 0) return null
  return (
    <>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshLambertMaterial color={palette.paper} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
      <Line segments points={edges} color={palette.ink} lineWidth={1} transparent opacity={0.45} />
    </>
  )
}
