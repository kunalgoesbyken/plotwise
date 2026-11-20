export type XmlNode = { name: string; text: string; children: XmlNode[] }

type Tree = { stack: XmlNode[]; root: XmlNode | null }

const MAX_DEPTH = 100
const ENTITIES: Readonly<Record<string, string>> = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&apos;': "'" }

const decode = (text: string) => text.replace(/&(?:lt|gt|amp|quot|apos);/g, (entity) => ENTITIES[entity])

const localName = (qualified: string) => qualified.slice(qualified.lastIndexOf(':') + 1)

const innermost = ({ stack }: Tree): XmlNode | undefined => stack[stack.length - 1]

function tagEnd(source: string, from: number): number {
  let quote = ''
  for (let i = from; i < source.length; i++) {
    const char = source[i]
    if (quote) quote = char === quote ? '' : quote
    else if (char === '"' || char === "'") quote = char
    else if (char === '>') return i
  }
  return -1
}

function endOf(source: string, marker: string, from: number): number {
  const end = source.indexOf(marker, from)
  return end < 0 ? -1 : end + marker.length
}

function addText(tree: Tree, text: string, raw: boolean): boolean {
  const current = innermost(tree)
  if (current) current.text += raw ? text : decode(text)
  return current !== undefined || (!raw && text.trim() === '')
}

function openElement(tree: Tree, name: string, selfClosing: boolean): boolean {
  const node: XmlNode = { name, text: '', children: [] }
  const parent = innermost(tree)
  if (parent) parent.children.push(node)
  else if (tree.root) return false
  else tree.root = node
  if (!selfClosing) tree.stack.push(node)
  return tree.stack.length <= MAX_DEPTH
}

const closeElement = (tree: Tree, name: string) => tree.stack.pop()?.name === name

function readTag(source: string, tree: Tree, open: number): number {
  const end = tagEnd(source, open)
  if (end < 0) return -1
  const inner = source.slice(open + 1, end)
  const closing = inner.startsWith('/')
  const name = localName(inner.replace(/^\//, '').split(/[\s/]/)[0])
  if (name === '') return -1
  const accepted = closing ? closeElement(tree, name) : openElement(tree, name, inner.endsWith('/'))
  return accepted ? end + 1 : -1
}

function readMarkup(source: string, tree: Tree, open: number): number {
  if (source.startsWith('<!--', open)) return endOf(source, '-->', open + 4)
  if (source.startsWith('<?', open)) return endOf(source, '?>', open + 2)
  if (source.startsWith('<![CDATA[', open)) {
    const end = source.indexOf(']]>', open)
    return end >= 0 && addText(tree, source.slice(open + 9, end), true) ? end + 3 : -1
  }
  if (source.startsWith('<!', open)) {
    const end = tagEnd(source, open)
    return end >= 0 && !source.slice(open, end).includes('[') ? end + 1 : -1
  }
  return readTag(source, tree, open)
}

export function parseXml(source: string): XmlNode | null {
  const tree: Tree = { stack: [], root: null }
  let position = 0
  while (position >= 0 && position < source.length) {
    const open = source.indexOf('<', position)
    const text = source.slice(position, open < 0 ? undefined : open)
    if (!addText(tree, text, false)) return null
    position = open < 0 ? source.length : readMarkup(source, tree, open)
  }
  return position >= 0 && tree.stack.length === 0 ? tree.root : null
}
