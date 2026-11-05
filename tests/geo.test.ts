import { describe, expect, it } from 'vitest'
import { bearingBetween, clamp, haversineKm, pathLength, pointAlong } from '../src/lib/geo'

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm([32.3, 30.5], [32.3, 30.5])).toBe(0)
  })

  it('matches a known distance (Suez north-south span)', () => {
    // Port Said -> Suez is about 160-165 km along a straight line
    const km = haversineKm([32.3067, 31.2505], [32.5834, 29.9984])
    expect(km).toBeGreaterThan(140)
    expect(km).toBeLessThan(175)
  })

  it('is symmetric', () => {
    const a = haversineKm([0, 0], [10, 10])
    const b = haversineKm([10, 10], [0, 0])
    expect(a).toBeCloseTo(b, 6)
  })
})

describe('pathLength', () => {
  it('sums segments', () => {
    const route: [number, number][] = [
      [0, 0],
      [0, 1],
      [0, 2],
    ]
    const single = haversineKm([0, 0], [0, 1])
    expect(pathLength(route)).toBeCloseTo(single * 2, 5)
  })

  it('is 0 for a single point', () => {
    expect(pathLength([[0, 0]])).toBe(0)
  })
})

describe('pointAlong', () => {
  const route: [number, number][] = [
    [0, 0],
    [0, 1],
    [0, 2],
  ]

  it('returns the first point at t=0', () => {
    expect(pointAlong(route, 0)).toEqual([0, 0])
  })

  it('returns the last point at t=1', () => {
    expect(pointAlong(route, 1)).toEqual([0, 2])
  })

  it('clamps out-of-range t', () => {
    expect(pointAlong(route, -5)).toEqual([0, 0])
    expect(pointAlong(route, 5)).toEqual([0, 2])
  })

  it('lands near the midpoint at t=0.5', () => {
    const mid = pointAlong(route, 0.5)
    expect(mid[1]).toBeCloseTo(1, 4)
  })

  it('is stable across repeated calls (segment cache)', () => {
    const a = pointAlong(route, 0.37)
    const b = pointAlong(route, 0.37)
    expect(a).toEqual(b)
  })
})

describe('bearingBetween', () => {
  it('points north', () => {
    expect(bearingBetween([0, 0], [0, 1])).toBeCloseTo(0, 1)
  })

  it('points east', () => {
    expect(bearingBetween([0, 0], [1, 0])).toBeCloseTo(90, 1)
  })

  it('points south', () => {
    expect(bearingBetween([0, 0], [0, -1])).toBeCloseTo(180, 1)
  })
})

describe('clamp', () => {
  it('bounds values', () => {
    expect(clamp(5, 0, 1)).toBe(1)
    expect(clamp(-5, 0, 1)).toBe(0)
    expect(clamp(0.5, 0, 1)).toBe(0.5)
  })
})
