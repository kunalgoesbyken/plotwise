import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { parseXml } from './xml'

describe('parseXml', () => {
  it('builds a tree of names, text and children', () => {
    const root = parseXml('<a><b>one</b><c><d> two </d></c></a>')
    expect(root?.name).toBe('a')
    expect(root?.children.map((c) => c.name)).toEqual(['b', 'c'])
    expect(root?.children[0].text).toBe('one')
    expect(root?.children[1].children[0].text).toBe(' two ')
  })

  it('drops namespace prefixes and attributes, including a > inside an attribute value', () => {
    const root = parseXml('<kml xmlns="http://example.test" xmlns:gx="http://example.test/gx"><gx:Track id="a>b" note=\'x\'>t</gx:Track></kml>')
    expect(root?.children[0].name).toBe('Track')
    expect(root?.children[0].text).toBe('t')
  })

  it('skips the declaration and comments, and reads CDATA as text', () => {
    const root = parseXml('<?xml version="1.0" encoding="UTF-8"?><!-- note <x> --><a><![CDATA[1 < 2 & 3]]></a>')
    expect(root?.name).toBe('a')
    expect(root?.text).toBe('1 < 2 & 3')
  })

  it('decodes the five predefined entities and nothing else', () => {
    expect(parseXml('<a>&lt;b&gt; &amp; &quot;c&quot; &apos;d&apos; &unknown;</a>')?.text).toBe('<b> & "c" \'d\' &unknown;')
  })

  it('reads self-closing elements', () => {
    const root = parseXml('<a><b/><c /></a>')
    expect(root?.children.map((c) => c.name)).toEqual(['b', 'c'])
  })

  it('reads Thai text', () => {
    expect(parseXml('<name>แปลงที่ดิน ซอยสุขุมวิท</name>')?.text).toBe('แปลงที่ดิน ซอยสุขุมวิท')
  })

  it('refuses malformed documents', () => {
    for (const bad of ['', 'text', '<a>', '<a></b>', '<a><b></a></b>', '<a', '<a><!-- open</a>', '<a><![CDATA[open</a>', '</a>']) {
      expect(parseXml(bad)).toBeNull()
    }
  })

  it('refuses a DTD, so entities are never expanded', () => {
    expect(parseXml('<!DOCTYPE a [<!ENTITY x "boom">]><a>&x;</a>')).toBeNull()
    expect(parseXml('<!DOCTYPE a><a>1</a>')?.name).toBe('a')
  })

  it('refuses nesting deeper than any real file', () => {
    expect(parseXml('<a>'.repeat(500) + '</a>'.repeat(500))).toBeNull()
  })

  it('never throws on any text', () => {
    fc.assert(fc.property(fc.string(), (text) => void parseXml(text)))
    fc.assert(fc.property(fc.array(fc.constantFrom('<', '>', '/', 'a', '!', '-', '[', ']', '?', '"', ' ', '&'), { maxLength: 40 }), (parts) => void parseXml(parts.join(''))))
  })
})
