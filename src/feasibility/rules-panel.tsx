'use client'

import { limitLabel } from '@/editor/limit-fields'
import { edgeName } from '@/editor/map-features'
import { useEditorState, useRegion } from '@/editor/plot-store'
import { WarningCircleIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { isParkingUnset, negate, ratioOpenSpace, stationDistance, type Limits, type UseLimit } from '@/solve'
import { formatBound, formatList, formatQuantity, formatRange } from '@/text/format'
import { t } from '@/text/messages'
import { useFeasibility } from './feasibility-provider'
import { Interpretations } from './interpretations'
import { LimitGroup, LimitRow } from './limit-row'
import { demandCites, demandText } from './parking-text'
import { WhenReady, type Ready } from './ready'
import { SetbackTable } from './setback-table'
import { SideRearGroup } from './side-rear-group'
import { siteEdgeNames } from './site-edges'
import { Sources } from './sources'
import { VerificationNote } from './verification-note'

const percent = (share: number) => formatQuantity(share, 'percent')

function Caution({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div role="note" className="flex gap-2 text-xs leading-relaxed">
      <WarningCircleIcon aria-hidden="true" weight="fill" className="mt-0.5 size-3.5 shrink-0 text-road" />
      <div className="min-w-0">
        {title && <p className="font-medium text-foreground">{title}</p>}
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  )
}

function BylawBanner({ solution }: Pick<Ready, 'solution'>) {
  const reading = solution.readings['bylaw-2569-scope']
  const question = solution.pack.questions.find((q) => q.id === 'bylaw-2569-scope')
  if (!question) return null
  const cites = question.readings.find((r) => r.id === reading)?.cites ?? []
  return (
    <Caution title={t('rules.bylaw.title')}>
      <p>{t(`rules.bylaw.${reading}`)}</p>
      <Sources cites={cites} />
    </Caution>
  )
}

function EstimatedRoads() {
  const { draft } = useEditorState()
  if (draft.status !== 'closed') return null
  const names = draft.corners.flatMap((c, i) => (c.edge.road && c.edge.estimated ? [edgeName(i, draft.corners.length)] : []))
  if (names.length === 0) return null
  return (
    <Caution>
      <p>{t('rules.estimated-roads', { edges: formatList(names) })}</p>
    </Caution>
  )
}

function FloorArea({ solution }: Pick<Ready, 'solution'>) {
  const { limits, widening, farAreaSqm } = solution
  const { areaUnit, areaTerms } = useRegion()
  const { farBonus } = useFeasibility()
  const eligible = limits.farBonus.measures.filter((m) => m.eligible)
  return (
    <LimitGroup title={t('rules.group.floor-area')}>
      <LimitRow
        label={t('limit.far', areaTerms)}
        value={t('value.far', { ratio: formatQuantity(limits.far.ratio, 'ratio') })}
        detail={t('limit.far.detail', { area: formatQuantity(limits.far.maxGfaSqm, areaUnit) })}
        cites={limits.far.cites}
      />
      {limits.farBonus.measures.length > 0 && (
        <LimitRow
          label={t('limit.far-bonus', areaTerms)}
          value={t('value.bonus', { share: percent(limits.farBonus.maxShare) })}
          detail={
            <>
              {t('limit.far-bonus.detail', {
                area: formatQuantity(limits.farBonus.maxGfaSqm, areaUnit),
                measures: formatList(eligible.map((m) => t(`bonus.${m.kind}`))),
              })}
              {limits.farBonus.extraGfaSqm > 0 && (
                <>
                  <br />
                  {t(farBonus ? 'limit.far-bonus.designs.on' : 'limit.far-bonus.designs.off')}
                </>
              )}
            </>
          }
          cites={[...limits.farBonus.cites, ...eligible.flatMap((m) => m.cites)]}
        />
      )}
      {limits.farPurchase.options.map((option) => (
        <LimitRow
          key={option.kind}
          label={t(`limit.purchase.${option.kind}`)}
          value={option.maxExtraGfaSqm > 0 ? formatBound({ cmp: 'lte', value: option.maxExtraGfaSqm / farAreaSqm }, 'ratio') : t('value.none')}
          detail={
            option.maxExtraGfaSqm > 0
              ? t('limit.purchase.detail', { area: formatQuantity(option.maxExtraGfaSqm, areaUnit), chosen: formatQuantity(option.chosenGfaSqm, areaUnit) })
              : t('limit.purchase.none')
          }
          cites={option.cites}
        />
      ))}
      {widening && (
        <LimitRow
          label={t('limit.widening')}
          value={formatQuantity(widening.reservedSqm, areaUnit)}
          detail={t('limit.widening.detail', { area: formatQuantity(widening.reservedSqm, areaUnit), gross: formatQuantity(widening.grossAreaSqm, areaUnit) })}
          cites={widening.cites}
        />
      )}
      {limits.inLieu && (
        <LimitRow
          label={t('limit.in-lieu')}
          value={formatQuantity(limits.inLieu.gfaSqm, areaUnit)}
          detail={t('limit.in-lieu.detail', { area: formatQuantity(limits.inLieu.gfaSqm, areaUnit) })}
          cites={limits.inLieu.cites}
        />
      )}
      {limits.coverage && (
        <LimitRow
          label={t('limit.coverage')}
          value={formatBound({ cmp: 'lte', value: limits.coverage.share }, 'percent')}
          detail={t('limit.coverage.detail', { area: formatQuantity(limits.coverage.maxFootprintSqm, areaUnit) })}
          cites={limits.coverage.cites}
        />
      )}
    </LimitGroup>
  )
}

function OpenSpace({ limits, maxGfaSqm }: { limits: Limits; maxGfaSqm: number }) {
  const { areaUnit } = useRegion()
  const { ratio, permeable, minimums } = limits.openSpace
  return (
    <LimitGroup title={t('rules.group.open-space')}>
      {ratio && (
        <LimitRow
          label={t('limit.open-space-ratio')}
          value={formatBound({ cmp: 'gte', value: ratio.value }, 'percent')}
          detail={t('limit.open-space-ratio.detail', { area: formatQuantity(ratioOpenSpace(limits, maxGfaSqm).value, areaUnit) })}
          cites={ratio.cites}
        />
      )}
      {permeable && (
        <LimitRow
          label={t('limit.permeable')}
          value={formatBound({ cmp: 'gte', value: permeable.value }, 'percent')}
          detail={t(`limit.permeable.${permeable.base}`)}
          cites={permeable.cites}
        />
      )}
      {minimums.map((minimum, i) => (
        <LimitRow
          key={i}
          label={t('limit.open-space-minimum')}
          value={formatBound({ cmp: 'gte', value: minimum.share }, 'percent')}
          detail={t(`limit.open-space-minimum.${minimum.base}.${minimum.scope}`)}
          cites={minimum.cites}
        />
      ))}
    </LimitGroup>
  )
}

function Height({ solution }: Pick<Ready, 'solution'>) {
  const { height, highRise } = solution.limits
  return (
    <LimitGroup title={t('rules.group.height')}>
      <LimitRow
        label={t('limit.height-plan')}
        value={height.planLimitM === null ? t('value.none') : formatQuantity(height.planLimitM, 'm')}
        detail={height.planLimitM === null ? t('limit.height-plan.detail') : undefined}
        cites={height.cites}
      />
      {height.vsRoadMultiple && (
        <LimitRow
          label={t('limit.height-vs-road')}
          value={t('value.multiple', { multiple: formatQuantity(height.vsRoadMultiple.value, 'ratio') })}
          detail={t('limit.height-vs-road.detail', { multiple: formatQuantity(height.vsRoadMultiple.value, 'ratio') })}
          cites={height.vsRoadMultiple.cites}
        />
      )}
      {highRise && (
        <LimitRow
          label={t('limit.high-rise-from')}
          value={formatBound(highRise.fromHeightM, 'm')}
          detail={t('limit.high-rise-from.detail')}
          cites={[highRise.fromHeightM.cite]}
        />
      )}
      {solution.envelopes.map((envelope) => (
        <LimitRow
          key={envelope.kind}
          label={t(`limit.envelope-top.${envelope.kind}`)}
          value={formatQuantity(envelope.prisms.at(-1)?.topM ?? 0, 'm')}
          detail={t(`limit.envelope-top.${envelope.kind}.detail`)}
          cites={[]}
        />
      ))}
    </LimitGroup>
  )
}

function HighRise({ limits }: { limits: Limits }) {
  const { areaUnit, areaTerms } = useRegion()
  if (!limits.highRise) return null
  const { access, farMax, fireLaneWidthM } = limits.highRise
  return (
    <LimitGroup title={t('rules.group.high-rise')}>
      {access.map((band, i) => (
        <LimitRow
          key={i}
          label={t('limit.high-rise-access', { area: formatRange(band.floorAreaSqm, areaUnit) })}
          value={t(band.qualifies ? 'value.met' : 'value.not-met')}
          detail={t('limit.high-rise-access.detail', { road: formatBound(band.roadWidthM, 'm'), frontage: formatBound(band.frontageM, 'm') })}
          cites={[band.roadWidthM.cite, band.frontageM.cite]}
        />
      ))}
      <LimitRow label={t('limit.fire-lane')} value={formatBound(fireLaneWidthM, 'm')} detail={t('limit.fire-lane.detail')} cites={[fireLaneWidthM.cite]} />
      <LimitRow
        label={t('limit.high-rise-far', areaTerms)}
        value={t('value.far', { ratio: formatQuantity(farMax.value, 'ratio') })}
        detail={t('limit.high-rise-far.detail')}
        cites={farMax.cites}
      />
    </LimitGroup>
  )
}

function exemptionText(use: Extract<UseLimit, { kind: 'restricted' }>, names: readonly string[]): string {
  switch (use.exemption.kind) {
    case 'none':
      return t('limit.use.exemption.none')
    case 'station':
      return t('limit.use.exemption.station')
    case 'road':
      return t('limit.use.exemption.road', { edge: names[use.exemption.edge] })
  }
}

function Use({ plot, solution }: Pick<Ready, 'plot' | 'solution'>) {
  const { use } = solution.limits
  const station = stationDistance(solution.pack)
  const { areaUnit, buildingNames } = useRegion()
  const title = t('rules.group.use', { building: buildingNames[plot.buildingType] })
  if (use.kind === 'permitted' || !station) {
    return (
      <LimitGroup title={title}>
        <LimitRow label={t('limit.use.permitted')} value={t('value.permitted')} detail={t('limit.use.permitted.detail')} cites={use.cites} />
      </LimitGroup>
    )
  }
  const quantity = use.measure === 'rooms' ? 'count' : areaUnit
  const exemptionCites = use.exemption.kind === 'none' ? [use.roadWidthM.cite] : use.exemption.cites
  return (
    <LimitGroup title={title}>
      <LimitRow
        label={t(`limit.use.${use.measure}`)}
        value={formatBound({ cmp: negate(use.threshold.cmp), value: use.threshold.value }, quantity)}
        detail={t('limit.use.unless', {
          road: formatBound(use.roadWidthM, 'm'),
          station: formatBound(station, 'm'),
          status: exemptionText(use, siteEdgeNames(plot, solution.site)),
        })}
        cites={[...use.cites, ...exemptionCites]}
      />
    </LimitGroup>
  )
}

function Parking({ plot, solution }: Pick<Ready, 'plot' | 'solution'>) {
  const region = useRegion()
  const { areaUnit } = region
  return (
    <LimitGroup title={t('rules.group.parking')}>
      {isParkingUnset(solution) && (
        <LimitRow label={limitLabel('parkingSqmPerSpace', region)} value={t('parking.not-set')} detail={t('parking.not-set.detail')} cites={[]} />
      )}
      {solution.limits.parking.rules.map((rule) => {
        const demand = rule[plot.buildingType]
        if (!demand) return null
        return (
          <LimitRow
            key={rule.scope}
            label={t(`parking.scope.${rule.scope}`)}
            detail={
              <>
                {demandText(demand, areaUnit)}
                {rule.visitors && (
                  <>
                    <br />
                    {t('parking.visitors', { share: formatQuantity(rule.visitors.share.value, 'percent'), min: rule.visitors.min.value })}
                  </>
                )}
                {rule.largeBuildingSqmPerSpace && (
                  <>
                    <br />
                    {t('parking.large', { area: formatQuantity(rule.largeBuildingSqmPerSpace.value, areaUnit) })}
                  </>
                )}
              </>
            }
            cites={[
              rule.appliesWhere,
              ...demandCites(demand),
              ...(rule.visitors ? [rule.visitors.share.cite] : []),
              ...(rule.largeBuildingSqmPerSpace ? [rule.largeBuildingSqmPerSpace.cite] : []),
            ]}
          />
        )
      })}
    </LimitGroup>
  )
}

function Rules({ plot, solution }: Ready) {
  const { site, limits } = solution
  const region = useRegion()
  return (
    <div>
      <div className="mb-5 flex flex-col gap-2">
        <VerificationNote solution={solution} detailed />
        <BylawBanner solution={solution} />
        <EstimatedRoads />
      </div>
      <div className="mb-5">
        <p className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
          <span className="font-medium">{region.zone?.name ?? region.name}</span>
          <span className="text-muted-foreground tabular-nums">{t('rules.plot-area', { area: formatQuantity(site.areaSqm, region.areaUnit) })}</span>
        </p>
        {region.cityPlan && <p className="mt-1 text-xs text-muted-foreground">{t('rules.plan', { plan: region.cityPlan.version })}</p>}
      </div>
      <FloorArea solution={solution} />
      <OpenSpace limits={limits} maxGfaSqm={solution.farCap.maxGfaSqm} />
      <SetbackTable plot={plot} solution={solution} />
      <SideRearGroup limit={limits.sideRear} />
      <Height solution={solution} />
      <HighRise limits={limits} />
      <Use plot={plot} solution={solution} />
      <Parking plot={plot} solution={solution} />
      <Interpretations questions={solution.pack.questions} readings={solution.readings} />
    </div>
  )
}

export function RulesPanel() {
  return <WhenReady render={(ready) => <Rules {...ready} />} />
}
