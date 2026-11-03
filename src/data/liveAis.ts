import type { Vessel, VesselTypeId } from '../types'
import { vesselTypes } from './fleet'

/**
 * Digitraffic (Fintraffic) open AIS.
 *
 * The only free, keyless, CORS-enabled live AIS feed found during the audit; it
 * covers the Baltic Sea and Finnish coastal waters. AISHub / MarineTraffic /
 * VesselFinder all require credentials, so live global coverage is not possible
 * from the browser alone — see the AIS proxy note in the README.
 */
const LOCATIONS_URL = 'https://meri.digitraffic.fi/api/ais/v1/locations'
const VESSELS_URL = 'https://meri.digitraffic.fi/api/ais/v1/vessels'

export interface LiveAisPosition {
  mmsi: number
  sog: number
  cog: number
  heading: number
  navStat: number
  lon: number
  lat: number
  timestamp: number
}

export interface LiveAisVesselMeta {
  mmsi: number
  name: string
  callsign: string
  destination: string
  draught: number
  shipType: number
  imo: number
}

export interface LiveAisSnapshot {
  fetchedAt: number
  positions: LiveAisPosition[]
  meta: Map<number, LiveAisVesselMeta>
}

type DigitrafficFeature = {
  properties: {
    mmsi: number
    sog?: number
    cog?: number
    heading?: number
    navStat?: number
    timestampExternal?: number
  }
  geometry: { coordinates: [number, number] }
}

type DigitrafficVessel = {
  mmsi: number
  name?: string
  callSign?: string
  destination?: string
  draught?: number
  shipType?: number
  imo?: number
}

function navStatusToVesselStatus(navStat: number): Vessel['status'] {
  // AIS nav status: 1 = at anchor, 5 = moored, 0 = under way using engine
  if (navStat === 1 || navStat === 5) return 'anchored'
  if (navStat === 8) return 'transit'
  return 'underway'
}

function classify(shipType: number, draughtM: number): VesselTypeId {
  // AIS ship type codes: 70-79 cargo, 80-89 tanker, 90+ other
  if (shipType >= 80 && shipType <= 89) {
    if (draughtM >= 15) return 'vlcc'
    return 'lng'
  }
  if (shipType >= 70 && shipType <= 79) {
    if (draughtM >= 14) return 'container'
    return 'bulk'
  }
  if (draughtM >= 15) return 'vlcc'
  return 'container'
}

export async function fetchLiveAis(signal?: AbortSignal): Promise<LiveAisSnapshot> {
  const [locRes, metaRes] = await Promise.all([
    fetch(LOCATIONS_URL, { signal, headers: { Accept: 'application/json' } }),
    fetch(VESSELS_URL, { signal, headers: { Accept: 'application/json' } }).catch(() => null),
  ])
  if (!locRes.ok) throw new Error(`Digitraffic AIS returned ${locRes.status}`)

  const locJson = (await locRes.json()) as { features?: DigitrafficFeature[] }
  const positions: LiveAisPosition[] = []
  for (const feature of locJson.features ?? []) {
    const p = feature.properties
    const [lon, lat] = feature.geometry.coordinates
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
    positions.push({
      mmsi: p.mmsi,
      sog: p.sog ?? 0,
      cog: p.cog ?? 0,
      heading: p.heading ?? p.cog ?? 0,
      navStat: p.navStat ?? 0,
      lon,
      lat,
      timestamp: p.timestampExternal ?? Date.now(),
    })
  }

  const meta = new Map<number, LiveAisVesselMeta>()
  if (metaRes?.ok) {
    const metaJson = (await metaRes.json()) as DigitrafficVessel[] | { features?: DigitrafficVessel[] }
    const list = Array.isArray(metaJson) ? metaJson : (metaJson.features ?? [])
    for (const vessel of list) {
      meta.set(vessel.mmsi, {
        mmsi: vessel.mmsi,
        name: vessel.name?.trim() ?? '',
        callsign: vessel.callSign?.trim() ?? '',
        destination: vessel.destination?.trim() ?? '',
        // Digitraffic reports draught in decimetres (e.g. 32 => 3.2 m)
        draught: vessel.draught !== undefined ? vessel.draught / 10 : 0,
        shipType: vessel.shipType ?? 0,
        imo: vessel.imo ?? 0,
      })
    }
  }

  return { fetchedAt: Date.now(), positions, meta }
}

/** Convert live AIS positions into the app's Vessel shape. */
export function liveAisToVessels(snapshot: LiveAisSnapshot): Vessel[] {
  const vessels: Vessel[] = []
  for (const pos of snapshot.positions) {
    const info = snapshot.meta.get(pos.mmsi)
    const name = info?.name && info.name.length > 0 ? info.name : `MMSI ${pos.mmsi}`
    const draught = info?.draught ?? 0
    const type = classify(info?.shipType ?? 0, draught)
    const status = navStatusToVesselStatus(pos.navStat)
    const meta = vesselTypes[type]

    vessels.push({
      id: `live-${pos.mmsi}`,
      mmsi: String(pos.mmsi),
      imo: info?.imo ? String(info.imo) : '—',
      name,
      type,
      flag: 'AIS',
      loa: meta.loa,
      beam: meta.beam,
      draft: draught > 0 ? draught : meta.draft,
      dwt: info?.shipType ? `TYPE ${info.shipType}` : 'AIS LIVE',
      speed: pos.sog,
      destination: info?.destination || '—',
      origin: info?.callsign ? `CS ${info.callsign}` : 'AIS',
      status,
      waitHours: 0,
      eta: new Date(pos.timestamp).toISOString().slice(11, 16),
      heading: pos.heading,
      progress: 0,
      direction: pos.cog > 180 ? 'out' : 'in',
      initialWait: 0,
      position: [pos.lon, pos.lat],
      live: true,
    })
  }
  return vessels
}
