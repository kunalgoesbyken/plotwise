import { describe, expect, it } from 'bun:test'
import { loadPack, PACK_IDS } from '.'

function leaves(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(leaves)
  if (node === null || typeof node !== 'object') return []
  const record = node as Record<string, unknown>
  if ('quote' in record && 'page' in record) return [JSON.stringify(record)]
  if ('cite' in record && 'value' in record) return [JSON.stringify({ value: record.value, cmp: record.cmp, cite: record.cite })]
  if ('term' in record && 'from' in record) return [JSON.stringify({ term: record.term, from: record.from, to: record.to })]
  return Object.values(record).flatMap(leaves)
}

describe.each(PACK_IDS)('pack %s keeps every sourced value', (id) => {
  it('lists the same cited values and quotes as before', () => {
    expect(leaves(loadPack(id)).sort()).toMatchSnapshot()
  })
})
