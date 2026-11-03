import type { Feature, Polygon } from 'geojson'
import type { LngLat } from '../types'

const EARTH_RADIUS_KM = 6371

export function haversineKm(from: LngLat, to: LngLat): number {
  const toRad = Math.PI / 180
  const dLat = (to[1] - from[1]) * toRad
  const dLng = (to[0] - from[0]) * toRad
  const lat1 = from[1] * toRad
  const lat2 = to[1] * toRad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

export function pathLength(route: LngLat[]): number {
  let total = 0
  for (let index = 1; index < route.length; index += 1) {
    total += haversineKm(route[index - 1], route[index])
  }
  return total
}

// pointAlong runs once per vessel per animation frame, so the cumulative
// segment lengths are cached against the route array rather than recomputed.
const segmentCache = new WeakMap<LngLat[], { lengths: number[]; total: number }>()

function segmentLengths(route: LngLat[]) {
  const cached = segmentCache.get(route)
  if (cached) return cached
  const lengths: number[] = []
  let total = 0
  for (let index = 1; index < route.length; index += 1) {
    const segment = haversineKm(route[index - 1], route[index])
    lengths.push(segment)
    total += segment
  }
  const entry = { lengths, total }
  segmentCache.set(route, entry)
  return entry
}

export function pointAlong(route: LngLat[], t: number): LngLat {
  if (route.length === 0) return [0, 0]
  if (route.length === 1) return route[0]
  const clamped = Math.max(0, Math.min(1, t))
  const { lengths: distances, total } = segmentLengths(route)
  let target = clamped * total
  for (let index = 0; index < distances.length; index += 1) {
    if (target <= distances[index]) {
      const fraction = distances[index] === 0 ? 0 : target / distances[index]
      return [
        route[index][0] + (route[index + 1][0] - route[index][0]) * fraction,
        route[index][1] + (route[index + 1][1] - route[index][1]) * fraction,
      ]
    }
    target -= distances[index]
  }
  return route[route.length - 1]
}

export function bearingBetween(from: LngLat, to: LngLat): number {
  const toRad = Math.PI / 180
  const fromLat = from[1] * toRad
  const toLat = to[1] * toRad
  const dLng = (to[0] - from[0]) * toRad
  const y = Math.sin(dLng) * Math.cos(toLat)
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLng)
  return (Math.atan2(y, x) / toRad + 360) % 360
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function formatCoordinate(value: LngLat, precision = 4): string {
  const lat = `${Math.abs(value[1]).toFixed(precision)}° ${value[1] >= 0 ? 'N' : 'S'}`
  const lng = `${Math.abs(value[0]).toFixed(precision)}° ${value[0] >= 0 ? 'E' : 'W'}`
  return `${lat} / ${lng}`
}

export function formatQueue(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

export function formatMoney(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`
  return `$${Math.round(value / 1000)}K`
}

export function circlePolygon(center: LngLat, radiusKm: number, steps = 48): Feature<Polygon> {
  const coordinates: number[][] = []
  const latDelta = radiusKm / 111
  const lngDelta = radiusKm / (111 * Math.cos((center[1] * Math.PI) / 180))
  for (let index = 0; index <= steps; index += 1) {
    const theta = (index / steps) * Math.PI * 2
    coordinates.push([center[0] + Math.cos(theta) * lngDelta, center[1] + Math.sin(theta) * latDelta])
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coordinates] },
  }
}
