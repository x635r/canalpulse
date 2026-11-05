import { describe, expect, it } from 'vitest'
import { findTideWindows, TIDE_STATIONS, type TideForecast } from '../src/data/tides'

function makeForecast(heights: number[]): TideForecast {
  return {
    status: 'available',
    station: 'TEST',
    stationName: 'Test Station',
    datum: 'MLLW',
    points: heights.map((h, i) => ({ time: `2026-11-05 ${String(i).padStart(2, '0')}:00`, height: h })),
    highWater: Math.max(...heights),
    lowWater: Math.min(...heights),
    note: '',
  }
}

describe('findTideWindows', () => {
  it('finds a contiguous window above the threshold', () => {
    const f = makeForecast([0.1, 0.3, 0.8, 0.9, 0.4, 0.2])
    const w = findTideWindows(f, 0.5)
    expect(w).toHaveLength(1)
    expect(w[0].start).toBe('2026-11-05 02:00')
    expect(w[0].end).toBe('2026-11-05 03:00')
    expect(w[0].peak).toBeCloseTo(0.9, 6)
  })

  it('finds two separate windows', () => {
    const f = makeForecast([0.9, 0.2, 0.1, 0.8, 0.9, 0.1])
    expect(findTideWindows(f, 0.5)).toHaveLength(2)
  })

  it('returns nothing when the tide never reaches the threshold', () => {
    const f = makeForecast([0.1, 0.2, 0.3])
    expect(findTideWindows(f, 1.5)).toEqual([])
  })

  it('handles a window that runs to the end of the forecast', () => {
    const f = makeForecast([0.1, 0.6, 0.9])
    const w = findTideWindows(f, 0.5)
    expect(w).toHaveLength(1)
    expect(w[0].end).toBe('2026-11-05 02:00')
  })

  it('returns nothing for an unavailable forecast even if points exist', () => {
    const f = { ...makeForecast([0.9, 0.9]), status: 'unavailable' as const }
    expect(findTideWindows(f, 0.1)).toEqual([])
  })
})

describe('TIDE_STATIONS', () => {
  it('only claims a station where one was verified to exist', () => {
    // Panama has Balboa; the rest must not pretend to have a source.
    expect(TIDE_STATIONS.panama?.id).toBe('9812501')
    expect(TIDE_STATIONS.suez).toBeUndefined()
    expect(TIDE_STATIONS.dover).toBeUndefined()
    expect(TIDE_STATIONS.gibraltar).toBeUndefined()
    expect(TIDE_STATIONS.hormuz).toBeUndefined()
  })
})
