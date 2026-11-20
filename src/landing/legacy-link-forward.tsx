'use client'

import { useEffect } from 'react'
import { decodePlot } from '@/editor/plot-url'

export function LegacyLinkForward() {
  useEffect(() => {
    if (decodePlot(location.hash) !== null) location.replace(`/app${location.hash}`)
  }, [])
  return null
}
