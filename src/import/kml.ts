import { shapeOf } from './shape'
import { fail, succeed, type Pair, type Result, type Shape, type Source } from './types'
import { parseXml, type XmlNode } from './xml'

type Found = { name: string | null; polygon: XmlNode }

const OUTER_RING_PATH = ['outerBoundaryIs', 'LinearRing', 'coordinates']

const trimmed = (node: XmlNode | undefined) => node?.text.trim() || null

const child = (node: XmlNode, name: string) => node.children.find((c) => c.name === name)

function polygonsIn(node: XmlNode, inherited: string | null): Found[] {
  if (node.name === 'Polygon') return [{ name: inherited, polygon: node }]
  const name = node.name === 'Placemark' ? (trimmed(child(node, 'name')) ?? inherited) : inherited
  return node.children.flatMap((c) => polygonsIn(c, name))
}

const readComponent = (text: string) => (text === '' ? null : Number(text))

function readTuple(tuple: string): Pair | null {
  const parts = tuple.split(',')
  if (parts.length < 2 || parts.length > 3) return null
  const numbers = parts.map(readComponent)
  return numbers.every((value) => value !== null && Number.isFinite(value)) ? [numbers[0]!, numbers[1]!] : null
}

function readCoordinates(text: string): Pair[] | null {
  const points = text.split(/\s+/).filter(Boolean).map(readTuple)
  return points.every((point) => point !== null) ? points : null
}

function shapeIn({ name, polygon }: Found): Shape | null {
  const coordinates = OUTER_RING_PATH.reduce<XmlNode | undefined>((node, step) => node && child(node, step), polygon)
  const points = coordinates && readCoordinates(coordinates.text)
  return points ? shapeOf(name, points, false) : null
}

export function parseKml(text: string): Result<Source> {
  const root = parseXml(text)
  if (!root) return fail('kml-invalid')
  const found = polygonsIn(root, null)
  if (found.length === 0) return fail('no-polygon')
  const shapes = found.map(shapeIn)
  return shapes.every((shape) => shape !== null) ? succeed({ shapes, question: { kind: 'fixed' } }) : fail('kml-invalid')
}
