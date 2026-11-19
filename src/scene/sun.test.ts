import { describe, expect, it } from 'bun:test'
import type { LngLat } from '@/geo/projection'
import { solarMorning, sunDirection } from './sun'

const BANGKOK: LngLat = [100.5268, 13.7236]
const DEG = Math.PI / 180

describe('solarMorning', () => {
  it('is mid-morning by the sun at the plot, whatever the time of day it is asked', () => {
    const late = solarMorning(new Date('2026-11-19T22:30:00Z'), BANGKOK)
    const early = solarMorning(new Date('2026-11-19T00:10:00Z'), BANGKOK)
    expect(late).toEqual(early)
    expect(late.toISOString()).toBe('2026-11-19T03:17:53.568Z')
  })
})

describe('sunDirection', () => {
  const direction = (iso: string) => sunDirection(new Date(iso), BANGKOK)

  it('is a unit vector', () => {
    expect(Math.hypot(...direction('2026-11-19T03:17:52Z'))).toBeCloseTo(1, 9)
  })

  it('stands in the south-east on a Bangkok November morning', () => {
    const [east, north, up] = direction('2026-11-19T03:17:52Z')
    expect(east).toBeGreaterThan(0)
    expect(north).toBeLessThan(0)
    expect(Math.asin(up) / DEG).toBeGreaterThan(35)
    expect(Math.asin(up) / DEG).toBeLessThan(55)
  })

  it('stands north of overhead at noon in June, south of it in December', () => {
    expect(direction('2026-06-21T05:18:00Z')[1]).toBeGreaterThan(0)
    expect(direction('2026-12-21T05:18:00Z')[1]).toBeLessThan(0)
    expect(Math.asin(direction('2026-03-20T05:18:00Z')[2]) / DEG).toBeCloseTo(90 - BANGKOK[1], 0)
  })
})
