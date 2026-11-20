import { afterEach, describe, expect, it } from 'bun:test'
import { OSM_ATTRIBUTION } from './assumptions'
import type { Bbox } from './bbox'
import { SiteRequestError } from './client'
import type { Site } from './schema'
import { loadSharedSite, siteCell } from './shared-site'

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

let nextCell = 0

function freshBbox(): Bbox {
  const west = 100.5 + 0.01 * nextCell++
  return [west, 13.76, west + 0.002, 13.762]
}

const siteFor = (bbox: Bbox): Site => ({ bbox, buildings: [], roads: [], stations: [], attribution: OSM_ATTRIBUTION })

type Reply = () => Promise<Response>

function serve(...replies: Reply[]) {
  const requests: string[] = []
  globalThis.fetch = ((input: string | URL | Request) => {
    requests.push(String(input))
    const reply = replies[Math.min(requests.length, replies.length) - 1]
    return reply()
  }) as typeof fetch
  return requests
}

const ok = (bbox: Bbox): Reply => () => Promise.resolve(Response.json(siteFor(bbox)))
const failing: Reply = () => Promise.resolve(Response.json({ error: 'upstream down' }, { status: 502 }))

function held(bbox: Bbox) {
  let release = () => {}
  const reply: Reply = () => new Promise((resolve) => (release = () => resolve(Response.json(siteFor(bbox)))))
  return { reply, release: () => release() }
}

describe('loadSharedSite', () => {
  it('sends one request for every caller asking for the same cell', async () => {
    const bbox = freshBbox()
    const requests = serve(ok(bbox))
    const [first, second] = await Promise.all([loadSharedSite(bbox, 'bkk'), loadSharedSite(bbox, 'bkk')])
    expect(requests).toHaveLength(1)
    expect(second).toBe(first)
    expect(await loadSharedSite(bbox, 'bkk')).toBe(first)
    expect(requests).toHaveLength(1)
  })

  it('keeps regions apart, since each region reads its own stations', async () => {
    const bbox = freshBbox()
    const requests = serve(ok(bbox))
    expect(siteCell(bbox, 'bkk')).not.toBe(siteCell(bbox, 'dxb'))
    await Promise.all([loadSharedSite(bbox, 'bkk'), loadSharedSite(bbox, 'dxb')])
    expect(requests).toHaveLength(2)
  })

  it('forgets a failed load, so the next caller tries again', async () => {
    const bbox = freshBbox()
    const requests = serve(failing, ok(bbox))
    await expect(loadSharedSite(bbox, 'bkk')).rejects.toBeInstanceOf(SiteRequestError)
    expect(await loadSharedSite(bbox, 'bkk')).toEqual(siteFor(bbox))
    expect(requests).toHaveLength(2)
  })

  it('lets one caller give up without cancelling the load the others wait for', async () => {
    const bbox = freshBbox()
    const { reply, release } = held(bbox)
    const requests = serve(reply)
    const leaving = new AbortController()
    const abandoned = loadSharedSite(bbox, 'bkk', { signal: leaving.signal })
    const waiting = loadSharedSite(bbox, 'bkk')
    leaving.abort(new Error('moved on'))
    await expect(abandoned).rejects.toThrow('moved on')
    release()
    expect(await waiting).toEqual(siteFor(bbox))
    expect(await loadSharedSite(bbox, 'bkk', { signal: new AbortController().signal })).toEqual(siteFor(bbox))
    expect(requests).toHaveLength(1)
  })

  it('refuses at once when the caller has already given up', async () => {
    const bbox = freshBbox()
    serve(ok(bbox))
    const gone = new AbortController()
    gone.abort(new Error('already gone'))
    await expect(loadSharedSite(bbox, 'bkk', { signal: gone.signal })).rejects.toThrow('already gone')
    expect(await loadSharedSite(bbox, 'bkk')).toEqual(siteFor(bbox))
  })
})
