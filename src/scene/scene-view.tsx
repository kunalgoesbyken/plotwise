'use client'

import { Canvas } from '@react-three/fiber'
import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/editor/ui'
import type { LocalFrame, Vec2 } from '@/geo/projection'
import type { Floor, Loop, Prism } from '@/geometry'
import type { Site } from '@/site/schema'
import { siteContext, standingBuildings } from './context'
import { framingOf, needsReframe } from './framing'
import { Buildings, Envelope, Ground, Massing, PlotMarks, Roads } from './layers'
import { buildingTones, readPalette } from './palette'
import { Orbit, Sun } from './rig'
import { useFullscreen } from './use-fullscreen'
import { useSettled } from './use-settled'

export type SceneDesign = { readonly id: string; readonly floors: readonly Floor[] }
export type ScenePlot = { readonly ring: Loop; readonly roadEdges: readonly number[] }

export type SceneViewProps = {
  readonly frame: LocalFrame
  readonly plot: ScenePlot
  readonly site: Site | null
  readonly envelope: readonly Prism[]
  readonly designs: readonly SceneDesign[]
  readonly selectedDesignId?: string
  readonly children?: ReactNode
}

const CAMERA = { fov: 35, near: 1, far: 8000, up: [0, 0, 1] } as const
const DPR: [number, number] = [1, 2]
const FOG_START_PER_RADIUS = 6
const FOG_END_PER_RADIUS = 14

const differentItems = <T,>(kept: readonly T[], next: readonly T[]) =>
  kept.length !== next.length || kept.some((item, i) => item !== next[i])

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

function describeScene(buildings: number | null, envelope: readonly Prism[], design: SceneDesign | undefined): string {
  const parts = [buildings === null ? '3D view of the plot.' : `3D view of the plot among ${plural(buildings, 'surrounding building')}.`]
  const envelopeTop = envelope.at(-1)?.topM
  if (envelopeTop !== undefined) parts.push(`Allowed envelope in ${plural(envelope.length, 'tier')}, up to ${Math.round(envelopeTop)} m.`)
  const designTop = design?.floors.at(-1)?.topM
  if (design && designTop !== undefined) parts.push(`Design: ${plural(design.floors.length, 'floor')}, ${Math.round(designTop)} m tall.`)
  return parts.join(' ')
}

export default function SceneView({ frame, plot, site, envelope, designs, selectedDesignId, children }: SceneViewProps) {
  const root = useRef<HTMLDivElement>(null)
  const helpId = useId()
  const fullscreen = useFullscreen(root)
  const [palette] = useState(readPalette)
  const [ready, setReady] = useState(false)
  const [resets, setResets] = useState(0)
  const tones = useMemo(() => buildingTones(palette), [palette])
  const context = useMemo(() => site && siteContext(site), [site])
  const [ox, oy] = context ? frame.toLocal(context.frame.origin) : [0, 0]
  const onPlot = useMemo(
    () => (context ? standingBuildings(context.buildings, plot.ring.map(([x, y]): Vec2 => [x - ox, y - oy])) : []),
    [context, plot.ring, ox, oy],
  )
  const standing = useSettled(onPlot, differentItems)
  const design = designs.find((d) => d.id === selectedDesignId) ?? designs[0]
  const topM = Math.max(0, ...envelope.map((p) => p.topM), ...(design?.floors.map((f) => f.topM) ?? []))
  const framing = useSettled(framingOf(plot.ring, topM), needsReframe)

  return (
    <div
      ref={root}
      className="relative size-full bg-vellum"
      data-scene-ready={ready}
      data-scene-buildings={context ? standing.length : undefined}
      data-scene-hidden-buildings={context ? context.buildings.length - standing.length : undefined}
      data-scene-roads={context?.roads.length}
      data-scene-plot-corners={plot.ring.length}
      data-scene-tiers={envelope.length}
      data-scene-floors={design?.floors.length ?? 0}
    >
      <Canvas
        frameloop="demand"
        shadows="percentage"
        flat
        dpr={DPR}
        camera={CAMERA}
        onCreated={() => setReady(true)}
        role="application"
        aria-roledescription="3D view"
        aria-label={describeScene(context ? standing.length : null, envelope, design)}
        aria-describedby={helpId}
        tabIndex={0}
      >
        <color attach="background" args={[palette.vellum]} />
        <fog attach="fog" args={[palette.vellum, framing.radiusM * FOG_START_PER_RADIUS, framing.radiusM * FOG_END_PER_RADIUS]} />
        <Sun framing={framing} at={frame.origin} palette={palette} />
        <Ground color={palette.rule} />
        {context && (
          <group position={[ox, oy, 0]}>
            <Roads roads={context.roads} color={palette.paper} />
            <Buildings buildings={standing} tones={tones} />
          </group>
        )}
        <PlotMarks ring={plot.ring} roadEdges={plot.roadEdges} palette={palette} />
        <Envelope prisms={envelope} color={palette.plot} />
        {design && <Massing floors={design.floors} palette={palette} />}
        <Orbit key={resets} framing={framing} />
      </Canvas>
      <p id={helpId} className="sr-only">
        Drag to orbit, right-drag to pan and scroll to zoom. With the view focused, the arrow keys pan and Shift with the arrow keys orbits.
      </p>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start gap-2 p-2">
        <div className="pointer-events-auto mr-auto">{children}</div>
        <Button className="pointer-events-auto" onClick={() => setResets((n) => n + 1)}>
          Reset view
        </Button>
        {fullscreen.supported && (
          <Button className="pointer-events-auto" onClick={fullscreen.toggle}>
            {fullscreen.active ? 'Exit full screen' : 'Full screen'}
          </Button>
        )}
      </div>
      <p className="pointer-events-none absolute bottom-1.5 left-2 font-mono text-[10px] text-slate">{site?.attribution}</p>
    </div>
  )
}
