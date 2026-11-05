/**
 * Tidal window calculation for under-keel clearance.
 *
 * Only a handful of the tracked waterways have an authoritative public tide
 * prediction available without a key. NOAA CO-OPS covers US waters and its
 * territories — which includes Balboa on the Panama Canal, but not Suez, Dover,
 * Hormuz, Gibraltar, Bab-el-Mandeb or Malacca.
 *
 * Where no station exists the module reports `unavailable` rather than
 * synthesising a sine wave, because a fabricated tide height feeding a UKC
 * verdict is worse than no number at all.
 */

import type { ChokepointId } from '../types'

const COOPS =
  'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'

export interface TidePoint {
  /** ISO-ish timestamp as returned by CO-OPS: "2026-11-05 04:00". */
  time: string
  /** Predicted height above chart datum, metres. */
  height: number
}

export interface TideForecast {
  status: 'available' | 'unavailable'
  station: string
  stationName: string
  datum: string
  points: TidePoint[]
  /** Highest predicted height in the window, metres. */
  highWater: number
  /** Lowest predicted height in the window, metres. */
  lowWater: number
  note: string
}

/**
 * NOAA stations that sit close enough to a tracked waterway to be meaningful.
 * Verified against the CO-OPS station catalogue; distances are to the gate.
 */
export const TIDE_STATIONS: Partial<Record<ChokepointId, { id: string; name: string }>> = {
  // Balboa, Canal Zone sits on the Pacific entrance of the Panama Canal (~25 km).
  panama: { id: '9812501', name: 'Balboa, Canal Zone' },
}

/** Waterways with no authoritative free tide prediction; keep the reason visible. */
export const TIDE_UNAVAILABLE_REASON: Partial<Record<ChokepointId, string>> = {
  suez: 'NOAA 不覆盖红海/地中海水域，苏伊士为海平面运河，潮差 <0.5m',
  bosphorus: '黑海—马尔马拉海为非正规半日潮，且无免费权威预报源',
  hormuz: '无免费权威潮汐预报源',
  gibraltar: '无免费权威潮汐预报源',
  malacca: '无免费权威潮汐预报源',
  'bab-el-mandeb': '无免费权威潮汐预报源',
  dover: 'UKHO 数据需付费授权',
}

function ymd(date: Date) {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(
    date.getUTCDate(),
  ).padStart(2, '0')}`
}

/**
 * Fetch a 48-hour hourly tide prediction with CORS enabled.
 * NOAA CO-OPS allows browser requests and returns JSON.
 */
export async function fetchTideForecast(
  chokepointId: ChokepointId,
  signal?: AbortSignal,
): Promise<TideForecast> {
  const station = TIDE_STATIONS[chokepointId]
  if (!station) {
    return {
      status: 'unavailable',
      station: '—',
      stationName: '—',
      datum: '—',
      points: [],
      highWater: Number.NaN,
      lowWater: Number.NaN,
      note: TIDE_UNAVAILABLE_REASON[chokepointId] ?? '该水域无免费权威潮汐预报源',
    }
  }

  const start = new Date()
  const end = new Date(start.getTime() + 48 * 3600 * 1000)
  const params = new URLSearchParams({
    product: 'predictions',
    application: 'CanalPulse',
    begin_date: ymd(start),
    end_date: ymd(end),
    datum: 'MLLW',
    station: station.id,
    time_zone: 'gmt',
    units: 'metric',
    interval: 'h',
    format: 'json',
  })

  const res = await fetch(`${COOPS}?${params}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`CO-OPS returned ${res.status}`)

  const json = (await res.json()) as { predictions?: { t: string; v: string }[] }
  const points: TidePoint[] = (json.predictions ?? []).map((p) => ({
    time: p.t,
    height: Number(p.v),
  }))

  if (points.length === 0) {
    return {
      status: 'unavailable',
      station: station.id,
      stationName: station.name,
      datum: 'MLLW',
      points: [],
      highWater: Number.NaN,
      lowWater: Number.NaN,
      note: 'CO-OPS 未返回有效预报',
    }
  }

  const heights = points.map((p) => p.height)
  return {
    status: 'available',
    station: station.id,
    stationName: station.name,
    datum: 'MLLW',
    points,
    highWater: Math.max(...heights),
    lowWater: Math.min(...heights),
    note: 'NOAA CO-OPS 逐小时潮汐预报',
  }
}

/**
 * Find contiguous windows in the forecast where the tide is at or above the
 * height needed to satisfy the required UKC.
 *
 * @param needHeight tide height (m) required above chart datum
 */
export function findTideWindows(
  forecast: TideForecast,
  needHeight: number,
): { start: string; end: string; peak: number }[] {
  if (forecast.status !== 'available') return []

  const windows: { start: string; end: string; peak: number }[] = []
  let current: { start: string; end: string; peak: number } | null = null

  for (const point of forecast.points) {
    if (point.height >= needHeight) {
      if (!current) {
        current = { start: point.time, end: point.time, peak: point.height }
      } else {
        current.end = point.time
        current.peak = Math.max(current.peak, point.height)
      }
    } else if (current) {
      windows.push(current)
      current = null
    }
  }
  if (current) windows.push(current)
  return windows
}
