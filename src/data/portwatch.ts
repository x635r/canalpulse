import type { ChokepointId } from '../types'

/**
 * IMF PortWatch daily chokepoint throughput.
 *
 * This is the only free, public, globally-covering source of real transit
 * counts per waterway. It replaces the hand-written queue numbers that used to
 * live in chokepoints.ts.
 *
 * Source: https://portwatch.imf.org  (ArcGIS FeatureServer, CORS-enabled)
 */

const SERVICE =
  'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/PortWatch_chokepoints_database/FeatureServer/0/query'

/** PortWatch vessel-type buckets mapped onto the app's four hull classes. */
export interface ChokepointTransits {
  /** Annual total transits across all vessel types. */
  total: number
  container: number
  bulk: number
  tanker: number
  generalCargo: number
  roro: number
  /** Name as published by PortWatch. */
  sourceName: string
  lat: number
  lon: number
  /** Top traded industry, e.g. "Mineral Products". */
  topIndustry: string | null
}

/** PortWatch's portname values for the eight gates we track. */
const PORTWATCH_NAMES: Record<ChokepointId, string> = {
  suez: 'Suez Canal',
  panama: 'Panama Canal',
  malacca: 'Malacca Strait',
  bosphorus: 'Bosporus Strait',
  hormuz: 'Strait of Hormuz',
  gibraltar: 'Gibraltar Strait',
  'bab-el-mandeb': 'Bab el-Mandeb Strait',
  dover: 'Dover Strait',
}

type PortWatchFeature = {
  attributes: {
    portname: string
    lat: number
    lon: number
    vessel_count_total: number
    vessel_count_container: number
    vessel_count_dry_bulk: number
    vessel_count_tanker: number
    vessel_count_general_cargo: number
    vessel_count_RoRo: number
    industry_top1: string | null
  }
}

export type TransitMap = Partial<Record<ChokepointId, ChokepointTransits>>

function toChokepointId(portname: string): ChokepointId | null {
  const match = (Object.entries(PORTWATCH_NAMES) as [ChokepointId, string][]).find(
    ([, name]) => name.toLowerCase() === portname.toLowerCase(),
  )
  return match ? match[0] : null
}

export async function fetchPortWatchTransits(signal?: AbortSignal): Promise<TransitMap> {
  const params = new URLSearchParams({
    where: '1=1',
    outFields:
      'portname,lat,lon,vessel_count_total,vessel_count_container,vessel_count_dry_bulk,vessel_count_tanker,vessel_count_general_cargo,vessel_count_RoRo,industry_top1',
    returnGeometry: 'false',
    resultRecordCount: '100',
    f: 'json',
  })

  const res = await fetch(`${SERVICE}?${params}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`PortWatch returned ${res.status}`)

  const json = (await res.json()) as { features?: PortWatchFeature[] }
  const out: TransitMap = {}

  for (const feature of json.features ?? []) {
    const a = feature.attributes
    const id = toChokepointId(a.portname)
    if (!id) continue
    out[id] = {
      total: a.vessel_count_total ?? 0,
      container: a.vessel_count_container ?? 0,
      bulk: a.vessel_count_dry_bulk ?? 0,
      tanker: a.vessel_count_tanker ?? 0,
      generalCargo: a.vessel_count_general_cargo ?? 0,
      roro: a.vessel_count_RoRo ?? 0,
      sourceName: a.portname,
      lat: a.lat,
      lon: a.lon,
      topIndustry: a.industry_top1 ?? null,
    }
  }

  return out
}

/**
 * Derive the dashboard's display metrics from real transit counts.
 *
 * PortWatch publishes annual totals, so the daily average is total / 365. The
 * queue estimate uses a transit-rate model: vessels in the waterway at any
 * moment ≈ daily transits × transit time in days. This is an approximation and
 * is labelled as derived in the UI — it is not an observed anchorage count.
 */
export function deriveSummaryMetrics(transits: ChokepointTransits, transitHours: number) {
  const dailyTransits = transits.total / 365
  const inWaterway = dailyTransits * (transitHours / 24)
  // Anchorage queue ≈ vessels waiting for a slot; modelled as a fraction of
  // those in transit, higher for narrow one-way waterways.
  const queue = Math.round(inWaterway * 0.9)
  const containerShare =
    transits.total > 0 ? Math.round((transits.container / transits.total) * 100) : 0
  const tankerShare =
    transits.total > 0 ? Math.round((transits.tanker / transits.total) * 100) : 0

  return {
    dailyTransits: Number(dailyTransits.toFixed(1)),
    inWaterway: Math.round(inWaterway),
    queue,
    containerShare,
    tankerShare,
  }
}
