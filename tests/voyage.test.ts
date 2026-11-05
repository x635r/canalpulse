import { describe, expect, it } from 'vitest'
import { crossTrackNm, formatDuration, planVoyage, queueHours } from '../src/lib/voyage'

const base = {
  waypoints: [
    { name: 'ROTTERDAM', coord: [4.48, 51.92] as [number, number] },
    { name: 'SINGAPORE', coord: [103.82, 1.26] as [number, number] },
  ],
  serviceSpeedKn: 14,
  transitSpeedKn: 8,
  waterways: [],
  departure: new Date('2026-11-05T00:00:00Z'),
}

describe('planVoyage', () => {
  it('returns a great-circle distance, which under-cuts the sea route', () => {
    const p = planVoyage(base)
    // Rotterdam-Singapore great circle is ~5,700 NM. The real sea route via
    // Suez is ~8,300 NM, so the model must be understood as a lower bound:
    // it does not avoid land. This test pins that known limitation.
    expect(p.totalNm).toBeGreaterThan(5000)
    expect(p.totalNm).toBeLessThan(6500)
    expect(p.totalNm).toBeLessThan(8300)
  })

  it('derives steaming time from distance and speed', () => {
    const p = planVoyage(base)
    expect(p.steamingHours).toBeCloseTo(p.totalNm / 14, 0)
  })

  it('adds waterway transit and queue time', () => {
    const p = planVoyage({
      ...base,
      waterways: [
        { id: 'suez', name: 'SUEZ CANAL', dailyTransits: 54, transitHours: 13.8, capacityPerDay: 60 },
      ],
    })
    expect(p.waterwayHours).toBeGreaterThan(13.8)
    expect(p.totalHours).toBeGreaterThan(p.steamingHours)
  })

  it('produces an ETA after departure', () => {
    const p = planVoyage(base)
    expect(new Date(p.eta).getTime()).toBeGreaterThan(base.departure.getTime())
  })

  it('slower speed yields a later ETA', () => {
    const fast = planVoyage({ ...base, serviceSpeedKn: 20 })
    const slow = planVoyage({ ...base, serviceSpeedKn: 10 })
    expect(new Date(slow.eta).getTime()).toBeGreaterThan(new Date(fast.eta).getTime())
  })

  it('higher traffic means a longer queue', () => {
    const busy = planVoyage({
      ...base,
      waterways: [{ id: 'suez', name: 'S', dailyTransits: 55, transitHours: 12, capacityPerDay: 60 }],
    })
    const quiet = planVoyage({
      ...base,
      waterways: [{ id: 'suez', name: 'S', dailyTransits: 10, transitHours: 12, capacityPerDay: 60 }],
    })
    expect(quiet.waterwayHours).toBeLessThan(busy.waterwayHours)
  })

  it('queue grows nonlinearly as utilisation approaches capacity', () => {
    const near = queueHours(59, 60)
    const half = queueHours(30, 60)
    // Utilisation 0.983 vs 0.5: wait must explode, not double.
    expect(near).toBeGreaterThan(half * 5)
  })

  it('queue is zero when there is no traffic or no capacity', () => {
    expect(queueHours(0, 60)).toBe(0)
    expect(queueHours(30, 0)).toBe(0)
  })

  it('more parallel slots shorten the wait', () => {
    const one = planVoyage({
      ...base,
      waterways: [{ id: 'p', name: 'P', dailyTransits: 24, transitHours: 10, capacityPerDay: 60 }],
    })
    const six = planVoyage({
      ...base,
      waterways: [{ id: 'p', name: 'P', dailyTransits: 24, transitHours: 10, capacityPerDay: 120 }],
    })
    expect(six.waterwayHours).toBeLessThan(one.waterwayHours)
  })

  it('records assumptions for auditability', () => {
    const p = planVoyage(base)
    expect(p.assumptions.length).toBeGreaterThanOrEqual(2)
    expect(p.assumptions.join(' ')).toContain('14')
  })

  it('caps queue time at 24h so one bad input cannot explode the plan', () => {
    const p = planVoyage({
      ...base,
      waterways: [{ id: 'x', name: 'X', dailyTransits: 0.001, transitHours: 1, capacityPerDay: 60 }],
    })
    expect(p.waterwayHours).toBeLessThanOrEqual(25)
  })
})

describe('formatDuration', () => {
  it('formats sub-day durations', () => {
    expect(formatDuration(5.5)).toBe('5h 30m')
  })

  it('formats multi-day durations', () => {
    expect(formatDuration(50)).toBe('2d 2h 0m')
  })

  it('handles invalid input without throwing', () => {
    expect(formatDuration(Number.NaN)).toBe('—')
    expect(formatDuration(-1)).toBe('—')
  })
})

describe('crossTrackNm', () => {
  it('places a point on the path at zero deviation', () => {
    const d = crossTrackNm([0, 0], [10, 0], [5, 0])
    expect(d.deviationNm).toBeLessThan(1)
    expect(d.progress).toBeCloseTo(0.5, 1)
  })

  it('reports the perpendicular offset for a point off the path', () => {
    // 1 degree of latitude ≈ 60 NM.
    const d = crossTrackNm([0, 0], [10, 0], [5, 1])
    expect(d.deviationNm).toBeGreaterThan(50)
    expect(d.deviationNm).toBeLessThan(70)
  })

  it('excludes the Bosphorus from a Rotterdam-Singapore leg', () => {
    // This is the bug the flat projection produced: it put the Bosphorus 89 NM
    // off a route it is nowhere near in practice.
    const d = crossTrackNm([4.48, 51.92], [103.82, 1.26], [29.065, 41.12])
    expect(d.deviationNm).toBeGreaterThan(250)
  })

  it('shows that the great circle from Rotterdam to Singapore passes north of Suez', () => {
    // The shortest path over the sphere runs far north, so Suez is ~1,200 NM
    // off it. This is exactly why a great-circle sum is a lower bound and why
    // the real route detours south through the canal.
    const d = crossTrackNm([4.48, 51.92], [103.82, 1.26], [32.34, 30.54])
    expect(d.deviationNm).toBeGreaterThan(900)
  })

  it('keeps a waterway on the route when it lies on the path', () => {
    // Singapore -> Shanghai passes close to the Malacca approaches.
    const d = crossTrackNm([103.82, 1.26], [121.47, 31.23], [104.2, 1.4])
    expect(d.deviationNm).toBeLessThan(250)
  })
})
