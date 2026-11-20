'use client'

import { useEffect, useState } from 'react'

const keyOf = (part: string) => part.split('=')[0]

export function writeHash(owned: readonly string[], fragment: string) {
  const kept = location.hash
    .replace(/^#/, '')
    .split('&')
    .filter((part) => part !== '' && !owned.includes(keyOf(part)))
  const next = [fragment, ...kept].filter(Boolean).join('&')
  const hash = next === '' ? '' : `#${next}`
  if (location.hash === hash) return
  history.replaceState(null, '', `${location.pathname}${location.search}${hash}`)
}

function readHashParam(key: string): string | null {
  return new URLSearchParams(location.hash.replace(/^#/, '')).get(key)
}

type HashCodec<T> = { readonly decode: (value: string | null) => T; readonly encode: (value: T) => string | null }

export function useHashState<T>(key: string, codec: HashCodec<T>) {
  const [value, setValue] = useState<T>(() => codec.decode(typeof window === 'undefined' ? null : readHashParam(key)))
  useEffect(() => {
    const encoded = codec.encode(value)
    writeHash([key], encoded === null ? '' : `${key}=${encodeURIComponent(encoded)}`)
  }, [key, codec, value])
  return [value, setValue] as const
}
