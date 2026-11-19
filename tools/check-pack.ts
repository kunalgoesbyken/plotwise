import { RulePackSchema, type Bound, type Cite, type Cited, type Range, type RulePack } from '../src/rules/types'

export type CheckResult = { errors: string[]; info: string[] }

type Check = (pack: RulePack) => string[]

const SHARE = { min: 0, max: 1 }
const DISTANCE_M = { min: 0, max: 50 }
const ROAD_WIDTH_M = { min: 0, max: 100 }

function outOfRange(path: string, value: number, range: { min: number; max: number }): string[] {
  return value > range.min && value <= range.max ? [] : [`${path} = ${value} is outside (${range.min}, ${range.max}]`]
}

const meets = (upper: Bound, lower: Bound) =>
  upper.value === lower.value && ((upper.cmp === 'lt' && lower.cmp === 'gte') || (upper.cmp === 'lte' && lower.cmp === 'gt'))

function contiguous(path: string, ranges: Range[]): string[] {
  const errors = ranges[0].min ? [`${path} does not start at 0`] : []
  ranges.slice(1).forEach((range, i) => {
    const prev = ranges[i]
    if (!prev.max || !range.min || !meets(prev.max, range.min)) errors.push(`${path} has a gap or overlap between bands ${i} and ${i + 1}`)
  })
  return errors
}

function nonDecreasing(path: string, values: number[]): string[] {
  return values.some((v, i) => i > 0 && v < values[i - 1]) ? [`${path} decreases: ${values.join(', ')}`] : []
}

function allEqual(path: string, values: Cited[]): string[] {
  return new Set(values.map((v) => v.value)).size > 1 ? [`${path}: sources disagree (${values.map((v) => `${v.cite.source} ${v.value}`).join(' vs ')})`] : []
}

function citedValues(node: unknown, path: string[] = []): { path: string; value: Cited }[] {
  if (Array.isArray(node)) return node.flatMap((child, i) => citedValues(child, [...path, String(i)]))
  if (node === null || typeof node !== 'object') return []
  if ('value' in node && 'cite' in node) return [{ path: path.join('.'), value: node as Cited }]
  return Object.entries(node).flatMap(([k, v]) => citedValues(v, [...path, k]))
}

function cites(node: unknown): Cite[] {
  if (Array.isArray(node)) return node.flatMap(cites)
  if (node === null || typeof node !== 'object') return []
  if ('quote' in node && 'source' in node) return [node as Cite]
  return Object.values(node).flatMap(cites)
}

const checkRanges: Check = (pack) => [
  ...outOfRange('far.max', pack.far.max.value, { min: 0, max: 20 }),
  ...outOfRange('openSpaceRatio.minShareOfFloorArea', pack.openSpaceRatio.minShareOfFloorArea.value, SHARE),
  ...outOfRange('openSpaceRatio.permeableShareOfOpenSpace', pack.openSpaceRatio.permeableShareOfOpenSpace.value, SHARE),
  ...pack.openSpaceMinimums.flatMap((rule, i) => outOfRange(`openSpaceMinimums.${i}`, rule.minShare.value, SHARE)),
  ...pack.boundarySetbacks.flatMap((rule, i) => rule.bands.flatMap((band, j) => outOfRange(`boundarySetbacks.${i}.bands.${j}`, band.distanceM.value, DISTANCE_M))),
  ...pack.useConditions.roadAccessTiers.flatMap((tier, i) => [
    ...outOfRange(`useConditions.roadAccessTiers.${i}.roadWidthM`, tier.roadWidthM.value, ROAD_WIDTH_M),
    ...outOfRange(`useConditions.roadAccessTiers.${i}.frontageM`, tier.frontageM.value, ROAD_WIDTH_M),
  ]),
  ...pack.heightVsRoad.maxMultipleOfDistance.flatMap((m, i) => outOfRange(`heightVsRoad.maxMultipleOfDistance.${i}`, m.value, { min: 0, max: 10 })),
]

const checkBands: Check = (pack) => {
  const highRise = pack.buildingClasses.highRiseFromHeightM
  return [
    ...pack.roadSetbacks.flatMap((rule, i) => {
      const ranges = rule.bands.map((b) => b.roadWidthM)
      const open = ranges.at(-1)?.max ? [`roadSetbacks.${i} does not cover the widest roads`] : []
      return [...contiguous(`roadSetbacks.${i}`, ranges), ...open]
    }),
    ...pack.boundarySetbacks.flatMap((rule, i) => {
      const path = `boundarySetbacks.${i}`
      const last = rule.bands.at(-1)?.heightM.max
      const end = last && !meets(last, highRise) ? [`${path} stops at ${last.value} m, not at the high-rise threshold`] : []
      return [...contiguous(path, rule.bands.map((b) => b.heightM)), ...end, ...nonDecreasing(path, rule.bands.map((b) => b.distanceM.value))]
    }),
    ...contiguous('highRise.access', pack.highRise.access.map((band) => band.floorAreaSqm)),
    ...nonDecreasing('highRise.access roadWidthM', pack.highRise.access.map((band) => band.roadWidthM.value)),
    ...nonDecreasing('useConditions.roadAccessTiers roadWidthM', pack.useConditions.roadAccessTiers.map((t) => t.roadWidthM.value)),
    ...nonDecreasing('useConditions.roadAccessTiers frontageM', pack.useConditions.roadAccessTiers.map((t) => t.frontageM.value)),
  ]
}

const checkBonus: Check = (pack) => {
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

const checkAgreement: Check = (pack) => allEqual('heightVsRoad.maxMultipleOfDistance', pack.heightVsRoad.maxMultipleOfDistance)

const checkUseConditions: Check = (pack) => {
  const tiers = new Set(pack.useConditions.roadAccessTiers.map((tier) => tier.roadWidthM.value))
  return (['condo', 'office', 'hotel'] as const).flatMap((type) => {
    const condition = pack.useConditions[type]
    if (condition.kind !== 'restrictedAbove' || tiers.has(condition.unlessRoadWidthM.value)) return []
    return [`useConditions.${type} needs a ${condition.unlessRoadWidthM.value} m road but ข้อ 36 has no such tier`]
  })
}

const checkSources: Check = (pack) => [
  ...cites(pack)
    .filter((cite) => !pack.sources[cite.source])
    .map((cite) => `cite to unlisted source ${cite.source} p${cite.page} l${cite.line}`),
  ...citedValues({ ...pack, questions: [] })
    .filter(({ value }) => pack.sources[value.cite.source]?.textLayer === 'garbled')
    .map(({ path, value }) => `${path} is read from ${value.cite.source}, whose text layer is garbled`),
]

const checkQuestions: Check = (pack) => {
  const ids = pack.questions.map((q) => q.id)
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i).map((id) => `question ${id} is listed twice`)
  const missing = Object.entries(pack.classification).flatMap(([type, classes]) =>
    Object.entries(classes)
      .filter(([, membership]) => membership.kind === 'question' && !ids.includes(membership.questionId))
      .map(([cls, membership]) => `classification.${type}.${cls} points to missing question ${membership.kind === 'question' ? membership.questionId : ''}`),
  )
  return [...duplicates, ...missing]
}

const checkDecided: Check = (pack) =>
  pack.questions.filter((q) => q.decision === null).map((q) => `question ${q.id} awaits a decision (recommended: ${q.recommendation})`)

const CHECKS: Check[] = [checkRanges, checkBands, checkBonus, checkAgreement, checkUseConditions, checkSources, checkQuestions, checkDecided]

export function checkPack(pack: RulePack): CheckResult {
  const capped = pack.far.max.value > pack.highRise.farMax.value ? [`plan FAR ${pack.far.max.value} is above the Reg 33 cap ${pack.highRise.farMax.value}`] : []
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
