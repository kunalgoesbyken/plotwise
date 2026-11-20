'use client'

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'
import { highRiseCost, rank, shownOption, type Design, type TypologyId } from '@/designs'
import { usePlot, useRegion } from '@/editor/plot-store'
import { useHashState } from '@/editor/url-hash'
import type { Plot } from '@/plot/plot'
import { loadPack, type FarPurchase, type RulePack } from '@/rules'
import type { Polygon } from '@/geometry'
import { STANDARD, wideningStrip, type Envelope, type FarChoice, type PurchaseRatios } from '@/solve'
import { feasibility, type Feasibility } from './compute'
import { decodePurchase, encodePurchase } from './purchase-url'
import { carvingRules, envelopeLayers, RULE_STEPS, type CarvingRules, type EnvelopeLayers, type RuleStep } from './rule-layers'

export type FeasibilityView = {
  readonly pack: RulePack
  readonly plot: Plot | null
  readonly result: Feasibility | null
  readonly design: Design | null
  readonly highRiseCostSqm: number | null
  readonly envelope: Envelope | null
  readonly carving: CarvingRules | null
  readonly layers: EnvelopeLayers | null
  readonly strip: readonly Polygon[]
  readonly farBonus: boolean
  readonly setFarBonus: (on: boolean) => void
  readonly far: FarChoice
  readonly buy: (kind: FarPurchase['kind'], ratio: number) => void
  readonly selectDesign: (id: TypologyId) => void
  readonly chooseStep: (step: RuleStep) => void
}

const FeasibilityContext = createContext<FeasibilityView | null>(null)

const ALL_RULES = RULE_STEPS[RULE_STEPS.length - 1]

const FAR_MODE_IN_URL = { decode: (value: string | null) => value === 'bonus', encode: (bonus: boolean) => (bonus ? 'bonus' : null) }

const PURCHASE_IN_URL = { decode: decodePurchase, encode: encodePurchase }

const NOTHING_BOUGHT: PurchaseRatios = {}

const NO_STRIP: readonly Polygon[] = []

function farChoice(pack: RulePack, farBonus: boolean, purchase: PurchaseRatios): FarChoice {
  if (pack.farPurchases) return { mode: 'purchased', ratios: purchase }
  return farBonus ? { mode: 'bonus' } : STANDARD
}

export function FeasibilityProvider({ children }: { children: ReactNode }) {
  const plot = usePlot()
  const region = useRegion()
  const pack = loadPack(region.packId)
  const [farBonus, setFarBonus] = useHashState('far', FAR_MODE_IN_URL)
  const [stored, setPurchase] = useHashState(`buy-${region.id}`, PURCHASE_IN_URL)
  const purchase = pack.farPurchases ? stored : NOTHING_BOUGHT
  const far = useMemo(() => farChoice(pack, farBonus, purchase), [pack, farBonus, purchase])
  const buy = useCallback((kind: FarPurchase['kind'], ratio: number) => setPurchase((current) => ({ ...current, [kind]: ratio })), [setPurchase])
  const result = useMemo(() => plot && feasibility(plot, pack, far), [plot, pack, far])
  const [designId, setDesignId] = useState<TypologyId | null>(null)
  const [step, setStep] = useState<RuleStep>(ALL_RULES)
  const ready = result?.status === 'ready' ? result : null
  const ranked = useMemo(() => (ready ? rank(ready.designs) : []), [ready])
  const highRiseCostSqm = useMemo(() => (ready ? highRiseCost(ready.solution, ready.designs) : null), [ready])
  const design = shownOption(ranked, designId)?.design ?? null
  const envelope = ready ? (ready.solution.envelopes.find((e) => e.kind === design?.envelope) ?? ready.solution.envelopes.at(-1) ?? null) : null
  const solution = ready?.solution
  const carving = useMemo(() => (solution ? carvingRules(solution.pack) : null), [solution])
  const strip = useMemo(() => (solution?.widening ? wideningStrip(solution.widening, solution.site.ring) : NO_STRIP), [solution])
  const layers = useMemo(() => (envelope && solution && carving ? envelopeLayers(envelope, solution.site, step, carving) : null), [envelope, solution, step, carving])
  const view = useMemo(
    () => ({ pack, plot, result, design, highRiseCostSqm, envelope, carving, layers, strip, farBonus, setFarBonus, far, buy, selectDesign: setDesignId, chooseStep: setStep }),
    [pack, plot, result, design, highRiseCostSqm, envelope, carving, layers, strip, farBonus, setFarBonus, far, buy],
  )
  return <FeasibilityContext value={view}>{children}</FeasibilityContext>
}

export function useFeasibility(): FeasibilityView {
  const view = use(FeasibilityContext)
  if (!view) throw new Error('useFeasibility must be used inside FeasibilityProvider')
  return view
}
