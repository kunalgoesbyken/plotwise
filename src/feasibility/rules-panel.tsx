'use client'

import { edgeName } from '@/editor/map-features'
import { useEditorState } from '@/editor/plot-store'
import type { ReactNode } from 'react'
import type { Bound, Range } from '@/rules'
import { negate, ratioOpenSpace, stationDistance, type Limits, type UseLimit } from '@/solve'
import { formatComparator, formatList, formatQuantity, type Quantity } from '@/text/format'
import { t } from '@/text/messages'
import { PACK } from './compute'
import { Interpretations } from './interpretations'
import { LimitGroup, LimitRow } from './limit-row'
import { demandCites, demandText } from './parking-text'
import { WhenReady, type Ready } from './ready'
import { SetbackTable } from './setback-table'
import { siteEdgeNames } from './site-edges'
import { Sources } from './sources'

const bound = ({ cmp, value }: Pick<Bound, 'cmp' | 'value'>, quantity: Quantity) =>
  `${formatComparator(cmp)} ${formatQuantity(value, quantity)}`

const percent = (share: number) => formatQuantity(share, 'percent')

function rangeText({ min, max }: Range): string {
  if (min && max) return t('range.between', { min: bound(min, 'sqm'), max: bound(max, 'sqm') })
  const only = min ?? max
  return only ? bound(only, 'sqm') : t('range.any')
}

function Caution({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div role="note" className="border-l-2 border-road pl-3 text-xs leading-relaxed">
      {title && <p className="font-semibold text-road-foreground">{title}</p>}
      {children}
    </div>
  )
}

function BylawBanner({ solution }: Pick<Ready, 'solution'>) {
  const reading = solution.readings['bylaw-2569-scope']
  const question = PACK.questions.find((q) => q.id === 'bylaw-2569-scope')
  const cites = question?.readings.find((r) => r.id === reading)?.cites ?? []
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

function FloorArea({ limits }: { limits: Limits }) {
  const eligible = limits.farBonus.measures.filter((m) => m.eligible)
  return (
    <LimitGroup title={t('rules.group.floor-area')}>
      <LimitRow
        label={t('limit.far')}
        value={t('value.far', { ratio: formatQuantity(limits.far.ratio, 'ratio') })}
        detail={t('limit.far.detail', { area: formatQuantity(limits.far.maxGfaSqm, 'sqm') })}
        cites={limits.far.cites}
      />
      <LimitRow
        label={t('limit.far-bonus')}
        value={t('value.bonus', { share: percent(limits.farBonus.maxShare) })}
        detail={t('limit.far-bonus.detail', {
          area: formatQuantity(limits.farBonus.maxGfaSqm, 'sqm'),
          measures: formatList(eligible.map((m) => t(`bonus.${m.kind}`))),
        })}
        cites={[...limits.farBonus.cites, ...eligible.flatMap((m) => m.cites)]}
      />
    </LimitGroup>
  )
}

function OpenSpace({ limits }: { limits: Limits }) {
  const { ratio, permeable, minimums } = limits.openSpace
  return (
    <LimitGroup title={t('rules.group.open-space')}>
      <LimitRow
        label={t('limit.open-space-ratio')}
        value={bound({ cmp: 'gte', value: ratio.value }, 'percent')}
        detail={t('limit.open-space-ratio.detail', { area: formatQuantity(ratioOpenSpace(limits, limits.far.maxGfaSqm).value, 'sqm') })}
        cites={ratio.cites}
      />
      <LimitRow
        label={t('limit.permeable')}
        value={bound({ cmp: 'gte', value: permeable.value }, 'percent')}
        detail={t(`limit.permeable.${permeable.base}`)}
        cites={permeable.cites}
      />
      {minimums.map((minimum, i) => (
        <LimitRow
          key={i}
          label={t('limit.open-space-minimum')}
          value={bound({ cmp: 'gte', value: minimum.share }, 'percent')}
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
      <LimitRow label={t('limit.height-plan')} value={t('value.none')} detail={t('limit.height-plan.detail')} cites={height.cites} />
      <LimitRow
        label={t('limit.height-vs-road')}
        value={t('value.multiple', { multiple: formatQuantity(height.vsRoadMultiple.value, 'ratio') })}
        detail={t('limit.height-vs-road.detail', { multiple: formatQuantity(height.vsRoadMultiple.value, 'ratio') })}
        cites={height.vsRoadMultiple.cites}
      />
      <LimitRow
        label={t('limit.high-rise-from')}
        value={bound(highRise.fromHeightM, 'm')}
        detail={t('limit.high-rise-from.detail')}
        cites={[highRise.fromHeightM.cite]}
      />
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
  const { access, farMax, fireLaneWidthM } = limits.highRise
  return (
    <LimitGroup title={t('rules.group.high-rise')}>
      {access.map((band, i) => (
        <LimitRow
          key={i}
          label={t('limit.high-rise-access', { area: rangeText(band.floorAreaSqm) })}
          value={t(band.qualifies ? 'value.met' : 'value.not-met')}
          detail={t('limit.high-rise-access.detail', { road: bound(band.roadWidthM, 'm'), frontage: bound(band.frontageM, 'm') })}
          cites={[band.roadWidthM.cite, band.frontageM.cite]}
        />
      ))}
      <LimitRow label={t('limit.fire-lane')} value={bound(fireLaneWidthM, 'm')} detail={t('limit.fire-lane.detail')} cites={[fireLaneWidthM.cite]} />
      <LimitRow
        label={t('limit.high-rise-far')}
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
  const title = t('rules.group.use', { building: t(`building.${plot.buildingType}`) })
  if (use.kind === 'permitted') {
    return (
      <LimitGroup title={title}>
        <LimitRow label={t('limit.use.permitted')} value={t('value.permitted')} detail={t('limit.use.permitted.detail')} cites={use.cites} />
      </LimitGroup>
    )
  }
  const quantity = use.measure === 'rooms' ? 'count' : 'sqm'
  const exemptionCites = use.exemption.kind === 'none' ? [use.roadWidthM.cite] : use.exemption.cites
  return (
    <LimitGroup title={title}>
      <LimitRow
        label={t(`limit.use.${use.measure}`)}
        value={bound({ cmp: negate(use.threshold.cmp), value: use.threshold.value }, quantity)}
        detail={t('limit.use.unless', {
          road: bound(use.roadWidthM, 'm'),
          station: bound(stationDistance(PACK), 'm'),
          status: exemptionText(use, siteEdgeNames(plot, solution.site)),
        })}
        cites={[...use.cites, ...exemptionCites]}
      />
    </LimitGroup>
  )
}

function Parking({ plot, solution }: Pick<Ready, 'plot' | 'solution'>) {
  return (
    <LimitGroup title={t('rules.group.parking')}>
      {solution.limits.parking.rules.map((rule) => {
        const demand = rule[plot.buildingType]
        return (
          <LimitRow
            key={rule.scope}
            label={t(`parking.scope.${rule.scope}`)}
            detail={
              <>
                {demandText(demand)}
                <br />
                {t('parking.large', { area: formatQuantity(rule.largeBuildingSqmPerSpace.value, 'sqm') })}
              </>
            }
            cites={[rule.appliesWhere, ...demandCites(demand), rule.largeBuildingSqmPerSpace.cite]}
          />
        )
      })}
    </LimitGroup>
  )
}

function Rules({ plot, solution }: Ready) {
  const { site, limits } = solution
  return (
    <div>
      <div className="mb-5 flex flex-col gap-2">
        <BylawBanner solution={solution} />
        <EstimatedRoads />
      </div>
      <p className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
        <span className="font-medium">{t('zone.name')}</span>
        <span className="text-muted-foreground tabular-nums">{t('rules.plot-area', { area: formatQuantity(site.areaSqm, 'sqm') })}</span>
      </p>
      <FloorArea limits={limits} />
      <OpenSpace limits={limits} />
      <SetbackTable plot={plot} solution={solution} />
      <Height solution={solution} />
      <HighRise limits={limits} />
      <Use plot={plot} solution={solution} />
      <Parking plot={plot} solution={solution} />
      <Interpretations readings={solution.readings} />
    </div>
  )
}

export function RulesPanel() {
  return <WhenReady render={(ready) => <Rules {...ready} />} />
}
