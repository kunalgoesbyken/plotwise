'use client'

import { useEffect, useRef } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'

export function PlotMap() {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let map: import('maplibre-gl').Map | undefined
    let cancelled = false
    import('maplibre-gl').then(({ Map }) => {
      if (cancelled || !container.current) return
      map = new Map({
        container: container.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [100.5018, 13.7563],
        zoom: 15,
        pitch: 45,
      })
    })
    return () => {
      cancelled = true
      map?.remove()
    }
  }, [])

  return <div ref={container} className="h-full w-full" />
}
