import bkkY9 from './packs/bkk-y9.json'
import custom from './packs/custom.json'
import dxbAp from './packs/dxb-ap.json'
import { RulePackSchema, type RulePack } from './pack'

const PACKS = { 'bkk-y9': bkkY9, 'dxb-ap': dxbAp, custom } as const

export type PackId = keyof typeof PACKS
export const PACK_IDS = Object.keys(PACKS) as PackId[]

const parsed = new Map<PackId, RulePack>()

export function loadPack(id: PackId): RulePack {
  const cached = parsed.get(id)
  if (cached) return cached
  const pack = RulePackSchema.parse(PACKS[id])
  parsed.set(id, pack)
  return pack
}
