import type { RegionId } from '@/solve'
import { bboxQuery, snapBbox, type Bbox } from './bbox'
import { fetchSite } from './client'
import type { Site } from './schema'

const loads = new Map<string, Promise<Site>>()

function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    promise.then(resolve, reject)
  })
}

export const siteCell = (bbox: Bbox, region: RegionId) => `${region}|${bboxQuery(snapBbox(bbox))}`

function startLoad(bbox: Bbox, region: RegionId, cell: string) {
  const load = fetchSite(bbox, region).catch((error: unknown) => {
    loads.delete(cell)
    throw error
  })
  loads.set(cell, load)
  return load
}

export function loadSharedSite(bbox: Bbox, region: RegionId, { signal }: { signal?: AbortSignal } = {}): Promise<Site> {
  const cell = siteCell(bbox, region)
  const load = loads.get(cell) ?? startLoad(bbox, region, cell)
  return signal ? untilAborted(load, signal) : load
}
