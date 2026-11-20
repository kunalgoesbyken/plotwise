import { bandGaps, endsOpen, meets } from '../src/rules/bands'
import { isSourceCite, type Cited, type Range, type SourceCite } from '../src/rules/cite'
import type { FarPurchase, FarRule } from '../src/rules/far'
import { RulePackSchema, type RulePack } from '../src/rules/pack'

export type CheckResult = { errors: string[]; info: string[] }

type Check = (pack: RulePack) => string[]

const SHARE = { min: 0, max: 1 }
const DISTANCE_M = { min: 0, max: 50 }
const ROAD_WIDTH_M = { min: 0, max: 100 }
const FAR_RATIO = { min: 0, max: 20 }
const HEIGHT_M = { min: 0, max: 1000 }
const STOREYS = { min: 0, max: 200 }
const PRICE_PER_SQM = { min: 0, max: 10_000_000 }

function outOfRange(path: string, value: number, range: { min: number; max: number }): string[] {
  return value > range.min && value <= range.max ? [] : [`${path} = ${value} is outside (${range.min}, ${range.max}]`]
}

const contiguous = (path: string, ranges: Range[]) => bandGaps(ranges).map((problem) => `${path} ${problem}`)

function nonDecreasing(path: string, values: number[]): string[] {
  return values.some((v, i) => i > 0 && v < values[i - 1]) ? [`${path} decreases: ${values.join(', ')}`] : []
}

function nonIncreasing(path: string, values: number[]): string[] {
  return values.some((v, i) => i > 0 && v > values[i - 1]) ? [`${path} increases: ${values.join(', ')}`] : []
}

function allEqual(path: string, values: Cited[]): string[] {
  return new Set(values.map((v) => v.value)).size > 1
    ? [`${path}: sources disagree (${values.map((v) => `${isSourceCite(v.cite) ? v.cite.source : 'entered'} ${v.value}`).join(' vs ')})`]
    : []
}

function citedValues(node: unknown, path: string[] = []): { path: string; value: Cited }[] {
  if (Array.isArray(node)) return node.flatMap((child, i) => citedValues(child, [...path, String(i)]))
  if (node === null || typeof node !== 'object') return []
  if ('value' in node && 'cite' in node) return [{ path: path.join('.'), value: node as Cited }]
  return Object.entries(node).flatMap(([k, v]) => citedValues(v, [...path, k]))
}

function cites(node: unknown): SourceCite[] {
  if (Array.isArray(node)) return node.flatMap(cites)
  if (node === null || typeof node !== 'object') return []
  if ('quote' in node && 'source' in node) return [node as SourceCite]
  return Object.values(node).flatMap(cites)
}

function farRanges(far: FarRule): string[] {
  switch (far.kind) {
    case 'zone':
      return outOfRange('far.max', far.max.value, FAR_RATIO)
    case 'byRoadWidthAndPlotSize':
      return far.roadWidthBands.flatMap((band, i) =>
        band.byPlotSize.flatMap((row, j) => outOfRange(`far.roadWidthBands.${i}.byPlotSize.${j}`, row.ratio.value, FAR_RATIO)),
      )
    case 'plotSpecific':
      return []
  }
}

function capRanges(path: string, cap: FarPurchase['cap']): string[] {
  switch (cap.kind) {
    case 'extraRatio':
      return outOfRange(path, cap.ratio.value, FAR_RATIO)
    case 'extraRatioByRoadWidth':
      return [
        ...contiguous(`${path}.bands`, cap.bands.map((band) => band.roadWidthM)),
        ...cap.bands.flatMap((band, j) => (band.kind === 'ratio' ? outOfRange(`${path}.bands.${j}`, band.ratio.value, FAR_RATIO) : [])),
      ]
    case 'shareOf':
      return outOfRange(path, cap.share.value, SHARE)
  }
}

function priceRanges(path: string, price: FarPurchase['price']): string[] {
  switch (price.kind) {
    case 'perSqm':
      return outOfRange(path, price.value.value, PRICE_PER_SQM)
    case 'shareOfLandRate':
      return outOfRange(path, price.share.value, SHARE)
    case 'userSupplied':
      return []
  }
}

const checkRanges: Check = (pack) => [
  ...farRanges(pack.far),
  ...(pack.farPurchases ?? []).flatMap((purchase, i) => [
    ...capRanges(`farPurchases.${i}.cap`, purchase.cap),
    ...priceRanges(`farPurchases.${i}.price`, purchase.price),
  ]),
  ...(pack.coverage?.kind === 'maxShare' ? outOfRange('coverage.share', pack.coverage.share.value, SHARE) : []),
  ...(pack.height.planLimit.kind === 'maxMetres' ? outOfRange('height.planLimit.maxM', pack.height.planLimit.maxM.value, HEIGHT_M) : []),
  ...(pack.height.planLimit.kind === 'maxStoreys' ? outOfRange('height.planLimit.maxStoreys', pack.height.planLimit.maxStoreys.value, STOREYS) : []),
  ...(pack.reservations ?? []).flatMap((reservation, i) => [
    ...(reservation.target.kind === 'width' ? outOfRange(`reservations.${i}.target.widthM`, reservation.target.widthM.value, ROAD_WIDTH_M) : []),
    ...(reservation.inLieu ? outOfRange(`reservations.${i}.inLieu.multipleOfReserved`, reservation.inLieu.multipleOfReserved.value, FAR_RATIO) : []),
  ]),
  ...(pack.openSpaceRatio
    ? [
        ...outOfRange('openSpaceRatio.minShareOfFloorArea', pack.openSpaceRatio.minShareOfFloorArea.value, SHARE),
        ...outOfRange('openSpaceRatio.permeableShareOfOpenSpace', pack.openSpaceRatio.permeableShareOfOpenSpace.value, SHARE),
      ]
    : []),
  ...pack.openSpaceMinimums.flatMap((rule, i) => outOfRange(`openSpaceMinimums.${i}`, rule.minShare.value, SHARE)),
  ...pack.boundarySetbacks.flatMap((rule, i) => rule.bands.flatMap((band, j) => outOfRange(`boundarySetbacks.${i}.bands.${j}`, band.distanceM.value, DISTANCE_M))),
  ...(pack.useConditions?.roadAccessTiers ?? []).flatMap((tier, i) => [
    ...outOfRange(`useConditions.roadAccessTiers.${i}.roadWidthM`, tier.roadWidthM.value, ROAD_WIDTH_M),
    ...outOfRange(`useConditions.roadAccessTiers.${i}.frontageM`, tier.frontageM.value, ROAD_WIDTH_M),
  ]),
  ...(pack.height.roadMultiple?.maxMultipleOfDistance ?? []).flatMap((m, i) =>
    outOfRange(`height.roadMultiple.maxMultipleOfDistance.${i}`, m.value, { min: 0, max: 10 }),
  ),
]

const checkBands: Check = (pack) => {
  const highRise = pack.buildingClasses?.highRiseFromHeightM
  return [
    ...pack.roadSetbacks.flatMap((rule, i) => {
      const ranges = rule.bands.map((b) => b.roadWidthM)
      const open = endsOpen(ranges) ? [] : [`roadSetbacks.${i} does not cover the widest roads`]
      return [...contiguous(`roadSetbacks.${i}`, ranges), ...open]
    }),
    ...pack.boundarySetbacks.flatMap((rule, i) => {
      const path = `boundarySetbacks.${i}`
      const last = rule.bands.at(-1)?.heightM.max
      const end = last && highRise && !meets(last, highRise) ? [`${path} stops at ${last.value} m, not at the high-rise threshold`] : []
      return [...contiguous(path, rule.bands.map((b) => b.heightM)), ...end, ...nonDecreasing(path, rule.bands.map((b) => b.distanceM.value))]
    }),
    ...(pack.highRise
      ? [
          ...contiguous('highRise.access', pack.highRise.access.map((band) => band.floorAreaSqm)),
          ...nonDecreasing('highRise.access roadWidthM', pack.highRise.access.map((band) => band.roadWidthM.value)),
        ]
      : []),
    ...(pack.useConditions
      ? [
          ...nonDecreasing('useConditions.roadAccessTiers roadWidthM', pack.useConditions.roadAccessTiers.map((t) => t.roadWidthM.value)),
          ...nonDecreasing('useConditions.roadAccessTiers frontageM', pack.useConditions.roadAccessTiers.map((t) => t.frontageM.value)),
        ]
      : []),
    ...parkingBands(pack),
  ]
}

function parkingBands({ parking }: RulePack): string[] {
  return parking.flatMap((rule, i) =>
    (['condo', 'office', 'hotel'] as const).flatMap((use) => {
      const demand = rule[use]
      const path = `parking.${i}.${use}`
      if (demand?.kind === 'perUnitBySize') return contiguous(path, demand.bands.map((band) => band.unitSqm))
      if (demand?.kind === 'unitsPerSpaceBySize') return [...contiguous(path, demand.bands.map((band) => band.unitSqm)), ...nonIncreasing(path, demand.bands.map((band) => band.unitsPerSpace.value))]
      return []
    }),
  )
}

const sameRange = (a: Range, b: Range) => a.min?.value === b.min?.value && a.max?.value === b.max?.value

function purchaseRatioIn(purchase: FarPurchase, roadWidthM: Range): number {
  if (purchase.cap.kind !== 'extraRatioByRoadWidth') return 0
  const band = purchase.cap.bands.find((b) => sameRange(b.roadWidthM, roadWidthM))
  return band?.kind === 'ratio' ? band.ratio.value : 0
}

const TOTAL_TOLERANCE = 1e-9

const checkFarTable: Check = ({ far, farPurchases }) => {
  if (far.kind !== 'byRoadWidthAndPlotSize') return []
  const bands = far.roadWidthBands
  const rows = Math.min(...bands.map((band) => band.byPlotSize.length))
  const totals = bands.flatMap((band, i) => {
    if (!band.permissible) return []
    const base = Math.max(...band.byPlotSize.map((row) => row.ratio.value))
    const total = (farPurchases ?? []).reduce((sum, purchase) => sum + purchaseRatioIn(purchase, band.roadWidthM), base)
    return Math.abs(total - band.permissible.value) > TOTAL_TOLERANCE
      ? [`far.roadWidthBands.${i}: base and purchases add to ${total}, but the permissible total reads ${band.permissible.value}`]
      : []
  })
  return [
    ...totals,
    ...Array.from({ length: rows }, (_, j) => nonDecreasing(`far.roadWidthBands plot size row ${j}`, bands.map((band) => band.byPlotSize[j].ratio.value))).flat(),
    ...nonDecreasing('far.roadWidthBands permissible', bands.flatMap((band) => (band.permissible ? [band.permissible.value] : []))),
  ]
}

const checkLowRise: Check = ({ lowRiseOpenSpaces }) => {
  if (!lowRiseOpenSpaces) return []
  const { rows } = lowRiseOpenSpaces
  const gaps = bandGaps(rows.map((row) => row.plotAreaSqm)).filter((problem) => problem !== 'does not start at 0')
  return [
    ...gaps.map((problem) => `lowRiseOpenSpaces.rows ${problem}`),
    ...nonDecreasing('lowRiseOpenSpaces front', rows.map((row) => row.frontM.value)),
    ...nonDecreasing('lowRiseOpenSpaces rear', rows.map((row) => row.rearM.value)),
    ...rows.flatMap((row, i) => [row.frontM, row.rearM, ...(row.sideM ? [row.sideM] : [])].flatMap((m) => outOfRange(`lowRiseOpenSpaces.rows.${i}`, m.value, DISTANCE_M))),
  ]
}

const checkBonus: Check = (pack) => {
  if (!pack.farBonus) return []
  const cap = pack.farBonus.combinedMaxShare.value
  return pack.farBonus.measures.flatMap((measure, i) => {
    const shares = measure.kind === 'energyRating' ? measure.levels.map((l) => l.share.value) : [measure.maxShare.value]
    const levels = measure.kind === 'energyRating' ? measure.levels.map((l) => l.level.value) : []
    return [
      ...shares.filter((share) => share <= 0 || share > cap).map((share) => `farBonus.measures.${i} share ${share} exceeds the combined cap ${cap}`),
      ...(levels.some((level, j) => level !== j + 1) ? [`farBonus.measures.${i} levels are not 1..${levels.length}`] : []),
      ...nonDecreasing(`farBonus.measures.${i} shares`, shares),
    ]
  })
}

const checkAgreement: Check = (pack) => [
  ...allEqual('height.roadMultiple.maxMultipleOfDistance', pack.height.roadMultiple?.maxMultipleOfDistance ?? []),
  ...allEqual('carpetArea.builtUpPerCarpet', pack.carpetArea?.builtUpPerCarpet ?? []),
  ...(pack.carpetArea?.builtUpPerCarpet ?? []).flatMap((ratio, i) => outOfRange(`carpetArea.builtUpPerCarpet.${i}`, ratio.value - 1, SHARE)),
]

const checkUseConditions: Check = ({ useConditions }) => {
  if (!useConditions) return []
  const tiers = new Set(useConditions.roadAccessTiers.map((tier) => tier.roadWidthM.value))
  return (['condo', 'office', 'hotel'] as const).flatMap((type) => {
    const condition = useConditions[type]
    if (condition.kind !== 'restrictedAbove' || tiers.has(condition.unlessRoadWidthM.value)) return []
    return [`useConditions.${type} needs a ${condition.unlessRoadWidthM.value} m road but ข้อ 36 has no such tier`]
  })
}

const checkSources: Check = (pack) => [
  ...cites(pack)
    .filter((cite) => !pack.sources[cite.source])
    .map((cite) => `cite to unlisted source ${cite.source} p${cite.page} l${cite.line}`),
  ...citedValues({ ...pack, questions: [] })
    .filter(({ value }) => isSourceCite(value.cite) && pack.sources[value.cite.source]?.textLayer === 'garbled')
    .map(({ path, value }) => `${path} is read from ${isSourceCite(value.cite) ? value.cite.source : ''}, whose text layer is garbled`),
]

const checkQuestions: Check = (pack) => {
  const ids = pack.questions.map((q) => q.id)
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i).map((id) => `question ${id} is listed twice`)
  const classes = Object.entries(pack.classification ?? {})
  const missing = classes.flatMap(([type, memberships]) =>
    Object.entries(memberships)
      .filter(([, membership]) => membership.kind === 'question' && !ids.includes(membership.questionId))
      .map(([cls, membership]) => `classification.${type}.${cls} points to missing question ${membership.kind === 'question' ? membership.questionId : ''}`),
  )
  return [...duplicates, ...missing]
}

const checkDecided: Check = (pack) =>
  pack.questions.filter((q) => q.decision === null).map((q) => `question ${q.id} awaits a decision (recommended: ${q.recommendation})`)

const CHECKS: Check[] = [checkRanges, checkBands, checkFarTable, checkLowRise, checkBonus, checkAgreement, checkUseConditions, checkSources, checkQuestions, checkDecided]

export function checkPack(pack: RulePack): CheckResult {
  const planFar = pack.far.kind === 'zone' ? pack.far.max.value : null
  const capped =
    planFar !== null && pack.highRise && planFar > pack.highRise.farMax.value
      ? [`plan FAR ${planFar} is above the Reg 33 cap ${pack.highRise.farMax.value}`]
      : []
  return { errors: CHECKS.flatMap((check) => check(pack)), info: capped }
}

if (import.meta.main) {
  const packId = Bun.argv[2]
  if (!packId) {
    console.error('usage: bun tools/check-pack.ts <packId>')
    process.exit(1)
  }
  const pack = RulePackSchema.parse(await Bun.file(`${import.meta.dir}/../src/rules/packs/${packId}.json`).json())
  const { errors, info } = checkPack(pack)
  info.forEach((line) => console.log(`info: ${line}`))
  errors.forEach((line) => console.error(`error: ${line}`))
  console.log(`${packId}: ${errors.length} errors, ${info.length} info`)
  if (errors.length) process.exit(1)
}
