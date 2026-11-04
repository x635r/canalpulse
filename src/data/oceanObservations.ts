/**
 * Live ocean observations: NOAA NDBC moored buoys and USGS seismic events.
 *
 * NDBC serves a fixed-width text feed with no CORS header, so the browser
 * cannot read it directly. It is fetched through the Pages Function proxy at
 * /api/ndbc (see functions/api/ndbc.ts). USGS does allow CORS and is called
 * directly.
 */

export interface BuoyObservation {
  station: string
  lat: number
  lon: number
  /** Wind direction, degrees true. */
  windDir: number | null
  /** Wind speed, m/s. */
  windSpeed: number | null
  /** Wave height, m. */
  waveHeight: number | null
  /** Dominant wave period, s. */
  wavePeriod: number | null
  /** Air temperature, °C. */
  airTemp: number | null
  /** Water temperature, °C. */
  waterTemp: number | null
  /** Sea level pressure, hPa. */
  pressure: number | null
  observedAt: string
}

export interface SeismicEvent {
  id: string
  magnitude: number
  place: string
  lat: number
  lon: number
  depthKm: number
  time: number
}

const BUOY_PROXY = '/api/ndbc'
const QUAKE_URL =
  'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=4.5&limit=200&orderby=time'

function num(raw: string): number | null {
  if (!raw || raw === 'MM') return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

/** Parse the NDBC latest_obs fixed-width feed. */
export function parseNdbc(text: string): BuoyObservation[] {
  const out: BuoyObservation[] = []
  const lines = text.split('\n')
  for (const line of lines) {
    // Skip the two header rows.
    if (!line.trim() || line.startsWith('#')) continue
    // Columns: STN LAT LON YYYY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ...
    const f = line.trim().split(/\s+/)
    if (f.length < 18) continue
    const lat = Number(f[1])
    const lon = Number(f[2])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    // Reject obviously bogus coordinates.
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue

    const station = f[0]
    const observedAt = `${f[3]}-${f[4]}-${f[5]}T${f[6]}:${f[7]}:00Z`
    out.push({
      station,
      lat,
      lon,
      windDir: num(f[8]),
      windSpeed: num(f[9]),
      waveHeight: num(f[11]),
      wavePeriod: num(f[12]),
      airTemp: num(f[16]),
      waterTemp: num(f[17]),
      pressure: num(f[15]),
      observedAt,
    })
  }
  return out
}

export async function fetchBuoys(signal?: AbortSignal): Promise<BuoyObservation[]> {
  const res = await fetch(BUOY_PROXY, { signal, headers: { Accept: 'text/plain' } })
  if (!res.ok) throw new Error(`Buoy feed returned ${res.status}`)
  return parseNdbc(await res.text())
}

type UsgsFeature = {
  id: string
  properties: { mag: number; place: string; time: number }
  geometry: { coordinates: [number, number, number] }
}

export async function fetchQuakes(signal?: AbortSignal): Promise<SeismicEvent[]> {
  const res = await fetch(QUAKE_URL, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Seismic feed returned ${res.status}`)
  const json = (await res.json()) as { features?: UsgsFeature[] }
  return (json.features ?? []).map((feature) => ({
    id: feature.id,
    magnitude: feature.properties.mag,
    place: feature.properties.place,
    lon: feature.geometry.coordinates[0],
    lat: feature.geometry.coordinates[1],
    depthKm: feature.geometry.coordinates[2],
    time: feature.properties.time,
  }))
}
