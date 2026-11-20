'use client'

import { Canvas } from '@react-three/fiber'
import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/ui/button'
import type { LocalFrame, Vec2 } from '@/geo/projection'
import type { Floor, Loop, Polygon, Prism } from '@/geometry'
import type { Site } from '@/site/schema'
import { t } from '@/text/messages'
import { siteContext, standingBuildings } from './context'
import { framingOf, needsReframe } from './framing'
import { Buildings, Envelope, Ground, Massing, PlotMarks, Roads, Strip } from './layers'
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
  readonly carved?: readonly Prism[] | null
  readonly strip?: readonly Polygon[]
  readonly designs: readonly SceneDesign[]
  readonly selectedDesignId?: string
  readonly controls?: ReactNode
  readonly children?: ReactNode
}

const CAMERA = { fov: 35, near: 1, far: 8000, up: [0, 0, 1] } as const
const DPR: [number, number] = [1, 2]
const FOG_START_PER_RADIUS = 6
const FOG_END_PER_RADIUS = 14

const differentItems = <T,>(kept: readonly T[], next: readonly T[]) =>
  kept.length !== next.length || kept.some((item, i) => item !== next[i])

function describeScene(buildings: number | null, envelope: readonly Prism[], design: SceneDesign | undefined): string {
  const parts = [buildings === null ? t('scene.describe.plot') : t('scene.describe.among', { count: buildings })]
  const envelopeTop = envelope.at(-1)?.topM
  if (envelopeTop !== undefined) parts.push(t('scene.describe.envelope', { tiers: envelope.length, height: Math.round(envelopeTop) }))
  const designTop = design?.floors.at(-1)?.topM
  if (design && designTop !== undefined) parts.push(t('scene.describe.design', { floors: design.floors.length, height: Math.round(designTop) }))
  return parts.join(' ')
}

export default function SceneView({ frame, plot, site, envelope, carved, strip, designs, selectedDesignId, controls, children }: SceneViewProps) {
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
  const topM = [...envelope, ...(design?.floors ?? [])].reduce((top, part) => Math.max(top, part.topM), 0)
  const framing = useSettled(framingOf(plot.ring, topM), needsReframe)

  return (
    <div
      ref={root}
      className="flex size-full flex-col bg-muted"
      data-scene-ready={ready}
      data-scene-buildings={context ? standing.length : undefined}
      data-scene-hidden-buildings={context ? context.buildings.length - standing.length : undefined}
      data-scene-roads={context?.roads.length}
      data-scene-plot-corners={plot.ring.length}
      data-scene-tiers={envelope.length}
      data-scene-floors={design?.floors.length ?? 0}
    >
      <div className="relative min-h-0 flex-1">
        <Canvas
          frameloop="demand"
          shadows="percentage"
          flat
          dpr={DPR}
          camera={CAMERA}
          onCreated={() => setReady(true)}
          role="application"
          aria-roledescription={t('scene.role')}
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
          {strip && strip.length > 0 && <Strip polygons={strip} color={palette.road} />}
          {carved && <Envelope prisms={carved} color={palette.signal} faint />}
          <Envelope prisms={envelope} color={palette.plot} />
          {design && <Massing floors={design.floors} palette={palette} />}
          <Orbit key={resets} framing={framing} />
        </Canvas>
        <p id={helpId} className="sr-only">
          {t('scene.help')}
        </p>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start gap-2 p-3">
          <div className="pointer-events-auto mr-auto">{children}</div>
          <Button variant="outline" size="sm" className="pointer-events-auto shadow-sm" onClick={() => setResets((n) => n + 1)}>
            {t('scene.reset')}
          </Button>
          {fullscreen.supported && (
            <Button variant="outline" size="sm" className="pointer-events-auto shadow-sm" onClick={fullscreen.toggle}>
              {t(fullscreen.active ? 'scene.fullscreen.exit' : 'scene.fullscreen.enter')}
            </Button>
          )}
        </div>
        <p className="pointer-events-none absolute bottom-2 left-3 text-2xs text-muted-foreground">{site?.attribution}</p>
      </div>
      {controls}
    </div>
  )
}
