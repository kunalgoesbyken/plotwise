'use client'

import dynamic from 'next/dynamic'
import { useMemo, type ReactNode } from 'react'
import { usePlot } from '@/editor/plot-store'
import { Button } from '@/editor/ui'
import { localFrame } from '@/geo/projection'
import type { Prism } from '@/geometry'
import type { Plot } from '@/plot/plot'
import { t } from '@/text/messages'
import type { SceneDesign } from './scene-view'
import { useSite, type SiteStatus } from './use-site'

const NOTE = 'rounded-md bg-paper px-2.5 py-1.5 text-xs text-slate shadow-sm ring-1 ring-rule'

const SceneView = dynamic(() => import('./scene-view'), {
  ssr: false,
  loading: () => <p className="grid size-full place-items-center bg-vellum text-sm text-slate">{t('scene.loading')}</p>,
})

type PlotSceneProps = {
  readonly envelope: readonly Prism[]
  readonly carved?: readonly Prism[] | null
  readonly designs: readonly SceneDesign[]
  readonly selectedDesignId?: string
  readonly controls?: ReactNode
}

function SiteNotice({ status, retry }: { status: SiteStatus; retry: () => void }) {
  return (
    <div aria-live="polite">
      {status === 'loading' && <p className={NOTE}>{t('scene.site.loading')}</p>}
      {status === 'failed' && (
        <div className={`flex items-center gap-2 ${NOTE}`}>
          <p>{t('scene.site.failed')}</p>
          <Button onClick={retry}>{t('scene.site.retry')}</Button>
        </div>
      )}
    </div>
  )
}

function LiveScene({ plot, ...scene }: PlotSceneProps & { plot: Plot }) {
  const frame = useMemo(() => localFrame(plot.ring[0]), [plot.ring])
  const scenePlot = useMemo(
    () => ({ ring: plot.ring.map(frame.toLocal), roadEdges: plot.roads.map((road) => road.edge) }),
    [plot, frame],
  )
  const { site, status, retry } = useSite(plot.ring)
  return (
    <SceneView frame={frame} plot={scenePlot} site={site} {...scene}>
      <SiteNotice status={status} retry={retry} />
    </SceneView>
  )
}

export function PlotScene(props: PlotSceneProps) {
  const plot = usePlot()
  return plot ? <LiveScene plot={plot} {...props} /> : null
}
