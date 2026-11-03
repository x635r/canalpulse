import type { Chokepoint, Vessel, VesselTypeId } from '../types'

export interface AisProxyVessel {
  mmsi: string | number
  imo?: string | number
  name: string
  latitude: number
  longitude: number
  sog?: number
  cog?: number
  heading?: number
  draught?: number
  length?: number
  beam?: number
  shipType?: number
  destination?: string
  navigationStatus?: number
  lastSeen?: string
}

export interface AisProxyEnvelope {
  fetchedAt?: string
  vessels: AisProxyVessel[]
}

const TYPE_BOUNDS = {
  container: 70,
  bulk: 74,
  lng: 84,
  vlcc: 88,
} as const

function classifyVessel(vessel: AisProxyVessel): VesselTypeId {
  const draft = vessel.draught ?? 0
  const length = vessel.length ?? 0
  if (length >= 320 && draft >= 17.5) return 'vlcc'
  if (vessel.shipType !== undefined && vessel.shipType >= TYPE_BOUNDS.lng && draft < 16) return 'lng'
  if (length >= 280 && draft >= 16.5) return 'bulk'
  if (vessel.shipType !== undefined && vessel.shipType >= TYPE_BOUNDS.container && draft >= 13.5) {
    return 'container'
  }
  return 'bulk'
}

function navigationStatus(value?: number): Vessel['status'] {
  if (value === 1) return 'anchored'
  if (value === 5) return 'transit'
  return 'underway'
}

export async function fetchAisSnapshot(
  chokepoint: Chokepoint,
  signal?: AbortSignal,
): Promise<AisProxyEnvelope | null> {
  const proxy = import.meta.env.VITE_AIS_PROXY_URL
  if (!proxy) return null

  const endpoint = `${proxy.replace(/\/$/, '')}/chokepoints/${encodeURIComponent(chokepoint.id)}/vessels`
  const response = await fetch(endpoint, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`AIS proxy returned ${response.status}`)
  }
  return (await response.json()) as AisProxyEnvelope
}

export function normalizeAisFleet(
  envelope: AisProxyEnvelope,
  chokepoint: Chokepoint,
): Vessel[] {
  return envelope.vessels
    .filter(
      (vessel) =>
        Number.isFinite(vessel.latitude) &&
        Number.isFinite(vessel.longitude) &&
        vessel.name,
    )
    .map((vessel) => {
      const type = classifyVessel(vessel)
      const status = navigationStatus(vessel.navigationStatus)
      return {
        id: `${chokepoint.id}-ais-${vessel.mmsi}`,
        mmsi: String(vessel.mmsi),
        imo: vessel.imo ? String(vessel.imo) : '—',
        name: vessel.name.trim().toUpperCase(),
        type,
        flag: 'AIS',
        loa: vessel.length ?? 0,
        beam: vessel.beam ?? 0,
        draft: vessel.draught ?? 0,
        dwt: 'AIS LIVE',
        speed: vessel.sog ?? 0,
        destination: vessel.destination || '—',
        origin: 'AIS',
        status,
        waitHours: 0,
        eta: vessel.lastSeen ?? '—',
        heading: vessel.heading ?? vessel.cog ?? 0,
        progress: 0,
        direction: vessel.cog !== undefined && vessel.cog > 180 ? 'out' : 'in',
        initialWait: 0,
        position: [vessel.longitude, vessel.latitude],
      } satisfies Vessel
    })
}
