'use client'

import { ExternalLink } from 'lucide-react'
import { EXAMPLE_PLOT } from '@/plot/example-plot'
import { t } from '@/text/messages'
import { Button } from '@/ui/button'
import { PanelSection } from '@/ui/section'
import { PlaceSearch } from './place-search'
import { useEditorState, useEditorStore } from './plot-store'

const BMA_CITY_PLAN_URL = 'https://webportal.bangkok.go.th/cpud'

function Outline() {
  const store = useEditorStore()
  const { draft } = useEditorState()
  const count = draft.status === 'closed' ? draft.corners.length : draft.points.length
  if (count === 0) {
    return (
      <div className="flex items-center gap-3 px-(--pad) pb-5">
        <span className="text-sm text-muted-foreground">{t('plot.or')}</span>
        <Button variant="outline" onClick={() => store.dispatch({ type: 'load-example', plot: EXAMPLE_PLOT })}>
          {t('plot.example')}
        </Button>
      </div>
    )
  }
  return (
    <PanelSection title={t('plot.title')} aside={t('plot.corners', { count })}>
      <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => store.dispatch({ type: 'clear' })}>
        {t('plot.clear')}
      </Button>
    </PanelSection>
  )
}

function Zone() {
  return (
    <p className="border-t px-(--pad) py-4 text-xs leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">{t('zone.name')}.</span> {t('zone.scope')}
      <a
        href={BMA_CITY_PLAN_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-1 flex min-h-11 w-fit items-center gap-1 font-medium text-primary underline-offset-2 hover:underline lg:min-h-0"
      >
        {t('zone.check')}
        <ExternalLink aria-hidden="true" className="size-3" />
      </a>
    </p>
  )
}

export function PlotStep() {
  return (
    <>
      <PlaceSearch />
      <Outline />
      <Zone />
    </>
  )
}
