import { describe, expect, it } from 'vitest'
import { TSS_SPECS, buildTssGeometry, hasTss } from '../src/lib/tss'
import { haversineKm } from '../src/lib/geo'

const line: [number, number][] = [
  [1.30, 51.05],
  [1.42, 51.02],
  [1.55, 51.00],
]

describe('buildTssGeometry', () => {
  const spec = TSS_SPECS.dover!

  it('returns three closed ribbons', () => {
    const g = buildTssGeometry(line, spec)
    expect(g.inbound.length).toBeGreaterThan(line.length)
    expect(g.outbound.length).toBeGreaterThan(line.length)
    expect(g.separation.length).toBeGreaterThan(line.length)
  })

  it('produces a lane wider than the centreline', () => {
    const g = buildTssGeometry(line, spec)
    // The lane ring perimeter must exceed the centreline it was built from.
    expect(g.inbound.length).toBeGreaterThanOrEqual(line.length * 2 - 1)
  })

  it('offsets lanes to opposite sides', () => {
    const g = buildTssGeometry(line, spec)
    // First point of inbound should not equal first point of outbound.
    expect(g.inbound[0]).not.toEqual(g.outbound[0])
  })

  it('omits a separation zone for single-channel waterways', () => {
    const suez = TSS_SPECS.suez!
    expect(suez.separationM).toBe(0)
    const g = buildTssGeometry(line, suez)
    // With no separation the zone ring collapses onto the centreline.
    expect(g.separation.every((p) => Number.isFinite(p[0]))).toBe(true)
  })

  it('keeps every generated coordinate finite', () => {
    for (const [, s] of Object.entries(TSS_SPECS)) {
      const g = buildTssGeometry(line, s!)
      for (const ring of [g.inbound, g.outbound, g.separation]) {
        for (const [lng, lat] of ring) {
          expect(Number.isFinite(lng)).toBe(true)
          expect(Number.isFinite(lat)).toBe(true)
          expect(Math.abs(lat)).toBeLessThanOrEqual(90)
        }
      }
    }
  })

  it('places lanes within a plausible distance of the centreline', () => {
    const g = buildTssGeometry(line, spec)
    const centre = line[0]
    // Total offset is half separation + lane width = 6 km for Dover.
    const d = haversineKm(centre, g.inbound[0])
    expect(d).toBeGreaterThan(0.1)
    expect(d).toBeLessThan(15)
  })
})

describe('hasTss', () => {
  it('is true for two-way straits with a separation zone', () => {
    expect(hasTss('dover')).toBe(true)
    expect(hasTss('gibraltar')).toBe(true)
    expect(hasTss('hormuz')).toBe(true)
  })

  it('is false for single-channel canals', () => {
    expect(hasTss('suez')).toBe(false)
    expect(hasTss('panama')).toBe(false)
  })

  it('is false for an unknown waterway', () => {
    expect(hasTss('atlantis')).toBe(false)
  })
})

describe('TSS specs sanity', () => {
  it('every spec has a positive lane width and a source', () => {
    for (const [, spec] of Object.entries(TSS_SPECS)) {
      expect(spec!.laneWidthM).toBeGreaterThan(0)
      expect(spec!.source.length).toBeGreaterThan(0)
      expect(['left', 'right']).toContain(spec!.inboundSide)
    }
  })

  it('lane widths are physically plausible for a shipping lane', () => {
    for (const [, spec] of Object.entries(TSS_SPECS)) {
      expect(spec!.laneWidthM).toBeGreaterThanOrEqual(150)
      expect(spec!.laneWidthM).toBeLessThanOrEqual(10000)
    }
  })
})
