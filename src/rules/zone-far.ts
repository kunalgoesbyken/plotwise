import type { FarRule } from './far'
import type { RulePack } from './pack'

export type ZoneFar = Extract<FarRule, { kind: 'zone' }>

export function zoneFar(pack: RulePack): ZoneFar {
  if (pack.far.kind !== 'zone') throw new Error(`pack ${pack.id} sets its FAR as ${pack.far.kind}, not by zone`)
  return pack.far
}
