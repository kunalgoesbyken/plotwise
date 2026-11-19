'use client'

import { totalArea } from '@/geometry'
import type { Envelope, Limits } from '@/solve'
import { formatQuantity } from '@/text/format'
import { SEGMENT, SEGMENTS } from '@/editor/ui'
import { t } from '@/text/messages'
import { CARVING } from './compute'
import { useFeasibility } from './feasibility-provider'
import { firstTierOf, RULE_STEPS, setbacksOf, type EnvelopeLayers } from './rule-layers'
import { Sources } from './sources'

const metres = (value: number) => formatQuantity(value, 'm')

type CaptionInput = { readonly envelope: Envelope; readonly layers: EnvelopeLayers; readonly limits: Limits }

function caption({ envelope, layers, limits }: CaptionInput): string {
  const { step } = layers
  const top = metres(layers.shown.at(-1)?.topM ?? 0)
  if (step === 'plot') return t('step.plot.caption', { height: top })
  const distances = setbacksOf(envelope, step, CARVING).map((s) => s.distanceM)
  const [least, most] = [Math.min(...distances), Math.max(...distances)]
  switch (step) {
    case 'setbacks':
      return t('step.setbacks.caption', { range: least === most ? metres(least) : t('range.span', { min: metres(least), max: metres(most) }) })
    case 'height-vs-road':
      return t('step.height-vs-road.caption', {
        from: metres(firstTierOf(envelope, step, CARVING)?.fromM ?? 0),
        multiple: formatQuantity(limits.height.vsRoadMultiple.value, 'ratio'),
        top,
      })
    case 'high-rise':
      return t('step.high-rise.caption', { distance: metres(most) })
  }
}

export function RuleStepper() {
  const { result, envelope, layers, chooseStep } = useFeasibility()
  if (result?.status !== 'ready' || !envelope || !layers) return null
  const footprint = totalArea(layers.shown[0]?.polygons ?? [])
  const cites = layers.step === 'plot' ? [] : setbacksOf(envelope, layers.step, CARVING).flatMap((s) => s.cites)
  return (
    <div className="border-t border-rule bg-paper px-3 pt-3 pb-1.5" data-rule-step={layers.step} data-envelope-footprint={Math.round(footprint)}>
      <div role="group" aria-label={t('step.label')} className={`${SEGMENTS} grid-cols-4`}>
        {RULE_STEPS.map((step, i) => {
          const available = layers.steps.includes(step)
          return (
            <button
              key={step}
              type="button"
              aria-pressed={layers.step === step}
              disabled={!available}
              title={available ? undefined : t('step.not-binding')}
              onClick={() => chooseStep(step)}
              className={`${SEGMENT} group/step px-1 text-xs disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <span className="font-mono text-2xs text-slate group-aria-pressed/step:text-plot">{i + 1}</span>
              {t(`step.${step}`)}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 px-0.5 pt-2">
        <p aria-live="polite" className="min-w-0 flex-1 basis-56 text-xs leading-snug">
          {caption({ envelope, layers, limits: result.solution.limits })}{' '}
          <span className="font-mono whitespace-nowrap text-slate tabular-nums">{t('step.footprint', { area: formatQuantity(footprint, 'sqm') })}</span>
        </p>
        <Sources cites={cites} className="open:basis-full [&>ul]:max-h-36 [&>ul]:overflow-y-auto" />
      </div>
    </div>
  )
}
