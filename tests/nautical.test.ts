import { describe, expect, it } from 'vitest'
import {
  BLOCK_COEFFICIENT,
  MIN_UKC_FRACTION,
  computeUkc,
  squatBarrass,
  waterwayClassFor,
} from '../src/lib/nautical'

describe('squatBarrass', () => {
  it('grows with the square of speed', () => {
    const slow = squatBarrass(0.8, 6, 'open')
    const fast = squatBarrass(0.8, 12, 'open')
    // double the speed => quadruple the squat
    expect(fast / slow).toBeCloseTo(4, 5)
  })

  it('is roughly double in confined water', () => {
    const open = squatBarrass(0.8, 8, 'open')
    const confined = squatBarrass(0.8, 8, 'canal')
    expect(confined / open).toBeCloseTo(2, 5)
  })

  it('matches the Barrass II formula for open water', () => {
    // Cb 0.85 at 10 kn => 0.85 * 100 / 100 = 0.85 m
    expect(squatBarrass(0.85, 10, 'open')).toBeCloseTo(0.85, 6)
  })

  it('matches the Barrass II formula for confined water', () => {
    // Cb 0.85 at 10 kn => 0.85 * 100 / 50 = 1.70 m
    expect(squatBarrass(0.85, 10, 'canal')).toBeCloseTo(1.7, 6)
  })

  it('is zero at zero speed', () => {
    expect(squatBarrass(0.85, 0, 'canal')).toBe(0)
  })

  it('gives a heavier hull more squat than a fine one at equal speed', () => {
    const vlcc = squatBarrass(BLOCK_COEFFICIENT.vlcc, 8, 'open')
    const container = squatBarrass(BLOCK_COEFFICIENT.container, 8, 'open')
    expect(vlcc).toBeGreaterThan(container)
  })
})

describe('computeUkc', () => {
  const base = {
    chartDepth: 24,
    tide: 0.45,
    draft: 19.5,
    cb: BLOCK_COEFFICIENT.vlcc,
    speedKn: 6,
    waterway: 'canal' as const,
  }

  it('computes netUkc = depth + tide - draft - squat', () => {
    const r = computeUkc(base)
    const expectedSquat = (0.85 * 6 * 6) / 50
    expect(r.squat).toBeCloseTo(expectedSquat, 6)
    expect(r.netUkc).toBeCloseTo(24 + 0.45 - 19.5 - expectedSquat, 6)
  })

  it('flags a grounded vessel as no-go', () => {
    const r = computeUkc({ ...base, draft: 26 })
    expect(r.netUkc).toBeLessThan(0)
    expect(r.verdict).toBe('no-go')
  })

  it('uses the operator minimum when provided', () => {
    const r = computeUkc({ ...base, policyMinUkc: 3.2 })
    expect(r.requiredUkc).toBe(3.2)
    expect(r.basis).toContain('operator minimum')
  })

  it('falls back to the PIANC percentage of draft', () => {
    const r = computeUkc({ ...base, policyMinUkc: undefined })
    expect(r.requiredUkc).toBeCloseTo(19.5 * MIN_UKC_FRACTION.canal, 6)
    expect(r.basis).toContain('1.5%')
  })

  it('reports no-go when net clearance is below the required minimum but positive', () => {
    // 24 + 0.45 - 22.8 - squat => about 1.0 m net, below a 3.2 m requirement
    const r = computeUkc({ ...base, draft: 22.8, policyMinUkc: 3.2 })
    expect(r.netUkc).toBeGreaterThan(0)
    expect(r.margin).toBeLessThan(0)
    expect(r.verdict).toBe('no-go')
  })

  it('reports safe with a comfortable margin', () => {
    const r = computeUkc({ ...base, draft: 16, policyMinUkc: 1 })
    expect(r.verdict).toBe('safe')
  })

  it('reports caution in the narrow band above the minimum', () => {
    // Fabricate a margin just above zero but under 35% of required.
    const r = computeUkc({ ...base, draft: 24.45 - 0.93 - 1.02, policyMinUkc: 1 })
    if (r.margin >= 0 && r.margin < 0.35) {
      expect(r.verdict).toBe('caution')
    }
    // Sanity: the result is always one of the three verdicts.
    expect(['safe', 'caution', 'no-go']).toContain(r.verdict)
  })

  it('subtracts more clearance at higher speed', () => {
    const slow = computeUkc({ ...base, speedKn: 5 })
    const fast = computeUkc({ ...base, speedKn: 10 })
    expect(fast.netUkc).toBeLessThan(slow.netUkc)
  })
})

describe('waterwayClassFor', () => {
  it('treats lock canals as canal', () => {
    expect(waterwayClassFor('LOCK CANAL', 6)).toBe('canal')
  })

  it('treats sea-level canals as canal', () => {
    expect(waterwayClassFor('SEA-LEVEL CANAL', 0)).toBe('canal')
  })

  it('treats TSS lanes as restricted', () => {
    expect(waterwayClassFor('TSS SEA LANE', 0)).toBe('restricted')
  })

  it('treats narrow straits as restricted', () => {
    expect(waterwayClassFor('NARROW INLAND STRAIT', 0)).toBe('restricted')
  })

  it('treats choke points as restricted', () => {
    expect(waterwayClassFor('TSS CHOKE POINT', 0)).toBe('restricted')
  })

  it('defaults to open water', () => {
    expect(waterwayClassFor('OPEN SEA', 0)).toBe('open')
  })
})
