'use client'

import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import { EXAMPLE_PLOT } from '@/plot/example-plot'
import { REGION } from '@/region/regions'
import { ZoneStatus } from '@/zone'
import { t } from '@/text/messages'
import { Button } from '@/ui/button'
import { PanelSection } from '@/ui/section'
import { PlaceSearch } from './place-search'
import { useEditorState, useEditorStore } from './plot-store'

function Start() {
  const store = useEditorStore()
  return (
    <div className="flex flex-col items-start gap-3 px-(--pad) pt-5 pb-5">
      <p className="text-base leading-snug font-medium text-pretty">{t('plot.framing', { city: REGION.city })}</p>
      <Button onClick={() => store.dispatch({ type: 'load-example', plot: EXAMPLE_PLOT })}>{t('plot.example')}</Button>
    </div>
  )
}

function Outline({ count }: { count: number }) {
  const store = useEditorStore()
  return (
    <PanelSection title={t('plot.title')} aside={t('plot.corners', { count })}>
      <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => store.dispatch({ type: 'clear' })}>
        {t('plot.clear')}
      </Button>
    </PanelSection>
  )
}

function ZoneScope() {
  return (
    <p className="border-t px-(--pad) py-4 text-xs leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">{REGION.zone.name}.</span> {REGION.zone.scope}
      <a
        href={REGION.cityPlan.url}
        target="_blank"
        rel="noreferrer"
        className="mt-1 flex min-h-11 w-fit items-center gap-1 font-medium text-foreground underline decoration-foreground/25 underline-offset-3 transition-colors hover:decoration-foreground lg:min-h-0"
      >
        {t('zone.check')}
        <ArrowSquareOutIcon aria-hidden="true" className="size-3.5" />
      </a>
    </p>
  )
}

export function PlotStep() {
  const { draft, plot } = useEditorState()
  const count = draft.status === 'closed' ? draft.corners.length : draft.points.length
  return (
    <>
      {count === 0 && <Start />}
      <PlaceSearch />
      {count > 0 && <Outline count={count} />}
      {plot ? (
        <div className="border-t px-(--pad) py-4">
          <ZoneStatus ring={plot.ring} />
        </div>
      ) : (
        <ZoneScope />
      )}
    </>
  )
}
