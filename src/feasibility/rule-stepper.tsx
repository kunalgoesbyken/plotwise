'use client'

import { useRegion } from '@/editor/plot-store'
import { totalArea } from '@/geometry'
import type { Envelope, Limits } from '@/solve'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { useFeasibility } from './feasibility-provider'
import { firstTierOf, RULE_STEPS, setbacksOf, type CarvingRules, type EnvelopeLayers, type RuleStep } from './rule-layers'
import { Sources } from './sources'

const metres = (value: number) => formatQuantity(value, 'm')

const isRuleStep = (value: string): value is RuleStep => (RULE_STEPS as readonly string[]).includes(value)

const KEY = [
  { key: 'legend.envelope', swatch: 'border-plot bg-plot/20' },
  { key: 'legend.carved', swatch: 'border-dashed border-destructive' },
  { key: 'legend.design', swatch: 'border-foreground/50 bg-background' },
] as const

function SceneKey() {
  return (
    <ul aria-label={t('legend.label')} className="flex flex-wrap gap-x-3 gap-y-1 text-2xs text-muted-foreground">
      {KEY.map(({ key, swatch }) => (
        <li key={key} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-2.5 rounded-xs border ${swatch}`} />
          {t(key)}
        </li>
      ))}
    </ul>
  )
}

type CaptionInput = { readonly envelope: Envelope; readonly layers: EnvelopeLayers; readonly limits: Limits; readonly carving: CarvingRules }

function caption({ envelope, layers, limits, carving }: CaptionInput): string {
  const { step } = layers
  const top = metres(layers.shown.at(-1)?.topM ?? 0)
  if (step === 'plot') return t('step.plot.caption', { height: top })
  const distances = setbacksOf(envelope, step, carving).map((s) => s.distanceM)
  const [least, most] = [Math.min(...distances), Math.max(...distances)]
  switch (step) {
    case 'setbacks':
      return t('step.setbacks.caption', { range: least === most ? metres(least) : t('range.span', { min: metres(least), max: metres(most) }) })
    case 'height-vs-road': {
      const multiple = limits.height.vsRoadMultiple
      if (!multiple) throw new Error('the road-height step needs the pack’s road-height rule')
      return t('step.height-vs-road.caption', {
        from: metres(firstTierOf(envelope, step, carving)?.fromM ?? 0),
        multiple: formatQuantity(multiple.value, 'ratio'),
        top,
      })
    }
    case 'high-rise':
      return t('step.high-rise.caption', { distance: metres(most) })
  }
}

export function RuleStepper() {
  const { result, envelope, layers, carving, chooseStep } = useFeasibility()
  const { areaUnit } = useRegion()
  if (result?.status !== 'ready' || !envelope || !layers || !carving) return null
  const footprint = totalArea(layers.shown[0]?.polygons ?? [])
  const cites = layers.step === 'plot' ? [] : setbacksOf(envelope, layers.step, carving).flatMap((s) => s.cites)
  return (
    <div className="@container flex flex-col gap-2 border-t bg-background px-3 pt-3 pb-1.5" data-rule-step={layers.step} data-envelope-footprint={Math.round(footprint)}>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label={t('step.label')}
        value={layers.step}
        onValueChange={(value) => isRuleStep(value) && chooseStep(value)}
        className="grid w-full max-w-2xl grid-cols-2 @xs:grid-cols-4"
      >
        {RULE_STEPS.map((step) => {
          const available = layers.steps.includes(step)
          return (
            <ToggleGroupItem
              key={step}
              value={step}
              disabled={!available}
              title={available ? undefined : t('step.not-binding')}
              className="w-full text-xs data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
            >
              {t(`step.${step}`)}
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
      <SceneKey />
      <div className="flex max-w-2xl flex-wrap items-baseline gap-x-3 px-0.5">
        <p aria-live="polite" className="min-w-0 flex-1 basis-56 text-xs leading-snug">
          {caption({ envelope, layers, limits: result.solution.limits, carving })}{' '}
          <span className="whitespace-nowrap text-muted-foreground">{t('step.footprint', { area: formatQuantity(footprint, areaUnit) })}</span>
        </p>
        <Sources cites={cites} className="data-[state=open]:basis-full [&_ul]:max-h-36 [&_ul]:overflow-y-auto" />
      </div>
    </div>
  )
}
