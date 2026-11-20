'use client'

import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import { EXAMPLE_PLOT } from '@/plot/example-plot'
import { DEFAULT_REGION, type Region } from '@/region/regions'
import { ZoneStatus } from '@/zone'
import { t } from '@/text/messages'
import { Button } from '@/ui/button'
import { PanelSection } from '@/ui/section'
import { PlaceSearch } from './place-search'
import { useEditorState, useEditorStore, useRegion } from './plot-store'
import { RegionPicker } from './region-picker'

function framing({ rules, city }: Region): string {
  if (rules === 'custom' || city === null) return t('plot.framing.custom')
  return t(`plot.framing.${rules}`, { city })
}

function Start() {
  const store = useEditorStore()
  const region = useRegion()
  return (
    <div className="flex flex-col items-start gap-3 px-(--pad) pt-5 pb-5">
      <p className="text-base leading-snug font-medium text-pretty">{framing(region)}</p>
      {region.id === DEFAULT_REGION.id && <Button onClick={() => store.dispatch({ type: 'load-example', plot: EXAMPLE_PLOT })}>{t('plot.example')}</Button>}
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

function ZoneScope({ zone, cityPlan }: { zone: NonNullable<Region['zone']>; cityPlan: Region['cityPlan'] }) {
  return (
    <p className="border-t px-(--pad) py-4 text-xs leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">{zone.name}.</span> {zone.scope}
      {cityPlan && (
        <a
          href={cityPlan.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 flex min-h-11 w-fit items-center gap-1 font-medium text-foreground underline decoration-foreground/25 underline-offset-3 transition-colors hover:decoration-foreground lg:min-h-0"
        >
          {t('zone.check')}
          <ArrowSquareOutIcon aria-hidden="true" className="size-3.5" />
        </a>
      )}
    </p>
  )
}

function Zone() {
  const { plot } = useEditorState()
  const { zone, cityPlan } = useRegion()
  if (!zone) return null
  if (!plot) return <ZoneScope zone={zone} cityPlan={cityPlan} />
  return (
    <div className="border-t px-(--pad) py-4">
      <ZoneStatus />
    </div>
  )
}

export function PlotStep() {
  const { draft } = useEditorState()
  const count = draft.status === 'closed' ? draft.corners.length : draft.points.length
  return (
    <>
      {count === 0 && <Start />}
      <RegionPicker />
      <PlaceSearch />
      {count > 0 && <Outline count={count} />}
      <Zone />
    </>
  )
}
