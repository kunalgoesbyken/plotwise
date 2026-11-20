import { describe, expect, it } from 'bun:test'
import { sharedStoreCredentials } from './shared-credentials'

const upstash = { UPSTASH_REDIS_REST_URL: 'https://eu-1.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'secret' }
const vercel = { KV_REST_API_URL: 'https://kv.upstash.io', KV_REST_API_TOKEN: 'kv-secret' }

describe('sharedStoreCredentials', () => {
  it('reads the names Upstash documents', () => {
    expect(sharedStoreCredentials(upstash)).toEqual({ url: 'https://eu-1.upstash.io', token: 'secret' })
  })

  it('reads the names the Vercel integration sets', () => {
    expect(sharedStoreCredentials(vercel)).toEqual({ url: 'https://kv.upstash.io', token: 'kv-secret' })
  })

  it('prefers the Upstash names when both are set', () => {
    expect(sharedStoreCredentials({ ...vercel, ...upstash })?.url).toBe('https://eu-1.upstash.io')
  })

  it('has no credentials without both a URL and a token', () => {
    expect(sharedStoreCredentials({})).toBeUndefined()
    expect(sharedStoreCredentials({ UPSTASH_REDIS_REST_URL: upstash.UPSTASH_REDIS_REST_URL })).toBeUndefined()
    expect(sharedStoreCredentials({ UPSTASH_REDIS_REST_TOKEN: upstash.UPSTASH_REDIS_REST_TOKEN })).toBeUndefined()
  })

  it('treats empty values as missing and falls through to the next name', () => {
    expect(sharedStoreCredentials({ UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '', ...vercel })).toEqual({
      url: 'https://kv.upstash.io',
      token: 'kv-secret',
    })
  })

  it('refuses a URL that is not an https address', () => {
    expect(sharedStoreCredentials({ ...upstash, UPSTASH_REDIS_REST_URL: 'not a url' })).toBeUndefined()
    expect(sharedStoreCredentials({ ...upstash, UPSTASH_REDIS_REST_URL: 'http://eu-1.upstash.io' })).toBeUndefined()
  })
})
