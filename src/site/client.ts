import { bboxQuery, snapBbox, type Bbox } from './bbox'
import { SiteErrorSchema, SiteSchema, type Site } from './schema'

export const SITE_ENDPOINT = '/api/site'

export class SiteRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export type FetchSiteOptions = { signal?: AbortSignal; fetchImpl?: typeof fetch }

async function failureOf(response: Response): Promise<SiteRequestError> {
  const body = SiteErrorSchema.safeParse(await response.json().catch(() => undefined))
  const message = body.success ? body.data.error : `Site request failed with HTTP ${response.status}`
  return new SiteRequestError(message, response.status)
}

export async function fetchSite(bbox: Bbox, { signal, fetchImpl = fetch }: FetchSiteOptions = {}): Promise<Site> {
  const response = await fetchImpl(`${SITE_ENDPOINT}?bbox=${bboxQuery(snapBbox(bbox))}`, { signal })
  if (!response.ok) throw await failureOf(response)
  return SiteSchema.parse(await response.json())
}
