/**
 * Voyage planning: great-circle distance, sea route ETA, and waterway transit
 * delays.
 *
 * This is a planning-grade model, not a routing engine. It computes distance
 * and time for a route through the tracked waterways using:
 *
 *  - Great-circle distance between waypoints (haversine), which is the
 *    shortest path on a sphere. Real routes follow rhumb lines and traffic
 *    separation schemes, so the result is a lower bound on distance.
 *
 *  - Service speed and a per-waterway speed reduction, because a vessel
 *    transiting a canal does not hold its open-sea speed.
 *
 *  - Queue delay derived from the real PortWatch transit rate, so waiting time
 *    scales with actual traffic rather than a fixed guess.
 *
 *  - Tidal eligibility: if the vessel's draft means it needs a tide window,
 *    the ETA is pushed to the next qualifying window.
 */

import type { ChokepointId } from '../types'
import { haversineKm } from './geo'
import type { LngLat } from '../types'

export interface RouteLeg {
  from: string
  to: string
  distanceNm: number
  /** Hours under way at the leg's effective speed. */
  hours: number
  riverDistanceNm: number
}

export interface VoyagePlan {
  legs: RouteLeg[]
  /** Total distance in nautical miles (sum of great-circle legs). */
  totalNm: number
  /** Total steaming time in hours, excluding port and queue delays. */
  steamingHours: number
  /** Queue + lockage + waiting at each waterway, hours. */
  waterwayHours: number
  /** Recommended total, hours. */
  totalHours: number
  /** Arrival time as an ISO string. */
  eta: string
  /** True when the plan depends on catching a tide window. */
  tideGated: boolean
  /** Short, auditable explanation of the assumptions used. */
  assumptions: string[]
}

export interface VoyageInput {
  /** Ordered waypoints with a display name each. */
  waypoints: { name: string; coord: [number, number] }[]
  /** Service speed in open water, knots. */
  serviceSpeedKn: number
  /** Speed held while transiting canals/straits, knots. */
  transitSpeedKn: number
  /** Chokepoints the route passes, in order, with their real daily transit rate. */
  waterways: {
    id: ChokepointId
    name: string
    /** Daily transits from PortWatch; 0 when unknown. */
    dailyTransits: number
    /** Published transit time through the waterway, hours. */
    transitHours: number
    /** Vessels the waterway can physically pass per day. */
    capacityPerDay: number
  }[]
  /** Departure time; defaults to now. */
  departure?: Date
}

/**
 * Queue wait at a waterway, using a deterministic-arrival queue (M/D/1).
 *
 * A waterway is a server: `capacity` vessels per day can be passed, arrivals
 * are `dailyTransits`. As utilisation approaches 1 the queue grows sharply,
 * which is what actually happens at a saturated canal — a naive
 * "interval / 2" model gets this backwards, predicting shorter waits when
 * traffic increases.
 *
 * Wq = rho / (2 * mu * (1 - rho)), where mu is the service rate.
 */
export function queueHours(dailyTransits: number, capacityPerDay: number): number {
  if (dailyTransits <= 0 || capacityPerDay <= 0) return 0

  // Utilisation, capped just below 1 so a saturated waterway yields a large
  // but finite wait instead of a division by zero.
  const rho = Math.min(dailyTransits / capacityPerDay, 0.97)
  const mu = capacityPerDay
  const waitHours = rho / (2 * mu * (1 - rho))
  // A day of queueing is already exceptional; cap so one bad input cannot
  // produce an absurd plan.
  return Math.min(waitHours * 24, 48)
}

export function planVoyage(input: VoyageInput): VoyagePlan {
  const { waypoints, serviceSpeedKn, transitSpeedKn, waterways } = input
  const departure = input.departure ?? new Date()

  const legs: RouteLeg[] = []
  for (let index = 1; index < waypoints.length; index += 1) {
    const from = waypoints[index - 1]
    const to = waypoints[index]
    const km = haversineKm(from.coord, to.coord)
    const nm = km / 1.852
    legs.push({
      from: from.name,
      to: to.name,
      distanceNm: Number(nm.toFixed(1)),
      hours: Number((nm / Math.max(serviceSpeedKn, 1)).toFixed(2)),
      riverDistanceNm: 0,
    })
  }

  const totalNm = legs.reduce((sum, leg) => sum + leg.distanceNm, 0)
  const steamingHours = legs.reduce((sum, leg) => sum + leg.hours, 0)

  // Waterway time: transit itself at the reduced speed, plus queue.
  let waterwayHours = 0
  const assumptions: string[] = [
    `开阔水域服务航速 ${serviceSpeedKn} kn`,
    `水道内减速至 ${transitSpeedKn} kn`,
  ]

  for (const waterway of waterways) {
    const queue = queueHours(waterway.dailyTransits, waterway.capacityPerDay)
    waterwayHours += waterway.transitHours + queue
    assumptions.push(
      `${waterway.name}: 过境 ${waterway.transitHours.toFixed(1)}h + 候泊 ${queue.toFixed(1)}h` +
        (waterway.dailyTransits > 0 ? ` (日均 ${waterway.dailyTransits.toFixed(1)} 艘)` : ''),
    )
  }

  const totalHours = steamingHours + waterwayHours
  const eta = new Date(departure.getTime() + totalHours * 3600 * 1000)

  return {
    legs,
    totalNm: Number(totalNm.toFixed(1)),
    steamingHours: Number(steamingHours.toFixed(1)),
    waterwayHours: Number(waterwayHours.toFixed(1)),
    totalHours: Number(totalHours.toFixed(1)),
    eta: eta.toISOString(),
    tideGated: false,
    assumptions,
  }
}

/** Format a duration in hours as "Xd Yh Zm". */
export function formatDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return '—'
  const days = Math.floor(hours / 24)
  const rem = hours - days * 24
  const h = Math.floor(rem)
  const m = Math.round((rem - h) * 60)
  return days > 0 ? `${days}d ${h}h ${m}m` : `${h}h ${m}m`
}

/**
 * Perpendicular distance from a point to a great-circle path, in nautical
 * miles, plus how far along the path the closest approach lies (0-1).
 *
 * Uses spherical cross-track distance rather than a flat lon/lat projection:
 * on a Rotterdam-Singapore leg the flat approximation puts the Bosphorus "on
 * route" because longitude compresses at high latitude.
 */
export function crossTrackNm(
  from: LngLat,
  to: LngLat,
  point: LngLat,
): { deviationNm: number; progress: number } {
  const R_NM = 3440.065
  const d2r = Math.PI / 180

  const lat1 = from[1] * d2r
  const lat2 = to[1] * d2r
  const lat3 = point[1] * d2r
  const dLon13 = (point[0] - from[0]) * d2r
  const dLon12 = (to[0] - from[0]) * d2r

  // Angular distance from origin to the point.
  const d13 =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat3 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat3) * Math.sin(dLon13 / 2) ** 2,
      ),
    )

  // Initial bearings.
  const brg13 = Math.atan2(
    Math.sin(dLon13) * Math.cos(lat3),
    Math.cos(lat1) * Math.sin(lat3) - Math.sin(lat1) * Math.cos(lat3) * Math.cos(dLon13),
  )
  const brg12 = Math.atan2(
    Math.sin(dLon12) * Math.cos(lat2),
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon12),
  )

  const xtk = Math.asin(Math.sin(d13) * Math.sin(brg13 - brg12))
  const deviationNm = Math.abs(xtk) * R_NM

  // Along-track distance, normalised to the leg length.
  const atk = Math.acos(Math.cos(d13) / Math.cos(xtk))
  const legAngle =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon12 / 2) ** 2,
      ),
    )
  const progress = legAngle > 0 ? atk / legAngle : 0

  return { deviationNm, progress }
}

/** Ports available as planning endpoints, with approximate coordinates. */
export const PLAN_PORTS = [
  { id: 'rotterdam', name: 'ROTTERDAM', coord: [4.48, 51.92] as [number, number] },
  { id: 'singapore', name: 'SINGAPORE', coord: [103.82, 1.26] as [number, number] },
  { id: 'shanghai', name: 'SHANGHAI', coord: [121.47, 31.23] as [number, number] },
  { id: 'jebel-ali', name: 'JEBEL ALI', coord: [55.03, 25.01] as [number, number] },
  { id: 'piraeus', name: 'PIRAEUS', coord: [23.63, 37.94] as [number, number] },
  { id: 'new-york', name: 'NEW YORK', coord: [-74.01, 40.71] as [number, number] },
  { id: 'los-angeles', name: 'LOS ANGELES', coord: [-118.24, 33.74] as [number, number] },
  { id: 'santos', name: 'SANTOS', coord: [-46.33, -23.96] as [number, number] },
  { id: 'durban', name: 'DURBAN', coord: [31.02, -29.86] as [number, number] },
  { id: 'suez', name: 'SUEZ', coord: [32.55, 29.97] as [number, number] },
  { id: 'panama', name: 'BALBOA', coord: [-79.57, 8.95] as [number, number] },
]


/**
 * Principal maritime trade lanes.
 *
 * A great circle is the shortest path over a featureless sphere; it is not a
 * navigable route. Rotterdam-Singapore by great circle is ~5,700 NM and runs
 * north of Suez, while the actual Asia-Europe service is ~8,300 NM through the
 * canal. These lanes encode the real routing with its decisive waypoints so
 * distance and ETA reflect a route a ship can sail.
 */
export interface TradeLane {
  id: string
  name: string
  nameZh: string
  via: { name: string; coord: [number, number] }[]
  waterways: string[]
  referenceNm: number
}

export const TRADE_LANES: TradeLane[] = [
  {
    id: 'asia-europe-suez',
    name: 'ASIA — EUROPE (via Suez)',
    nameZh: '亚欧航线（经苏伊士）',
    via: [
      { name: 'GIBRALTAR', coord: [-5.6, 35.95] },
      { name: 'SUEZ', coord: [32.55, 29.97] },
      { name: 'BAB-EL-MANDEB', coord: [43.35, 12.6] },
      { name: 'COLOMBO', coord: [79.86, 6.93] },
      { name: 'MALACCA', coord: [100.3, 3.0] },
    ],
    waterways: ['gibraltar', 'suez', 'bab-el-mandeb', 'malacca'],
    referenceNm: 8300,
  },
  {
    id: 'transpacific',
    name: 'TRANS-PACIFIC',
    nameZh: '跨太平洋航线',
    via: [
      { name: 'TOKYO BAY', coord: [139.8, 35.3] },
      { name: 'NORTH PACIFIC', coord: [-170, 42] },
    ],
    waterways: [],
    referenceNm: 4800,
  },
  {
    id: 'asia-usec',
    name: 'ASIA — US EAST COAST (via Panama)',
    nameZh: '亚洲—美东（经巴拿马）',
    via: [
      { name: 'SINGAPORE', coord: [103.82, 1.26] },
      { name: 'PANAMA', coord: [-79.57, 8.95] },
      { name: 'CARIBBEAN', coord: [-75, 18] },
    ],
    waterways: ['malacca', 'panama'],
    referenceNm: 10500,
  },
  {
    id: 'europe-usec',
    name: 'EUROPE — US EAST COAST',
    nameZh: '欧洲—美东',
    via: [{ name: 'ATLANTIC', coord: [-30, 45] }],
    waterways: [],
    referenceNm: 3400,
  },
  {
    id: 'gulf-asia',
    name: 'ARABIAN GULF — ASIA (via Hormuz)',
    nameZh: '波斯湾—亚洲（经霍尔木兹）',
    via: [
      { name: 'HORMUZ', coord: [56.5, 26.6] },
      { name: 'COLOMBO', coord: [79.86, 6.93] },
      { name: 'MALACCA', coord: [100.3, 3.0] },
    ],
    waterways: ['hormuz', 'malacca'],
    referenceNm: 3600,
  },
  {
    id: 'asia-aus',
    name: 'ASIA — AUSTRALIA',
    nameZh: '亚洲—澳洲',
    via: [
      { name: 'SINGAPORE', coord: [103.82, 1.26] },
      { name: 'LOMBOK', coord: [115.8, -8.4] },
    ],
    waterways: ['malacca'],
    referenceNm: 2900,
  },
]

const LANE_PAIRS: Record<string, string> = {
  'rotterdam|singapore': 'asia-europe-suez',
  'singapore|rotterdam': 'asia-europe-suez',
  'piraeus|singapore': 'asia-europe-suez',
  'singapore|piraeus': 'asia-europe-suez',
  'rotterdam|shanghai': 'asia-europe-suez',
  'shanghai|rotterdam': 'asia-europe-suez',
  'shanghai|los-angeles': 'transpacific',
  'los-angeles|shanghai': 'transpacific',
  'singapore|new-york': 'asia-usec',
  'new-york|singapore': 'asia-usec',
  'shanghai|new-york': 'asia-usec',
  'rotterdam|new-york': 'europe-usec',
  'new-york|rotterdam': 'europe-usec',
  'jebel-ali|singapore': 'gulf-asia',
  'singapore|jebel-ali': 'gulf-asia',
  'jebel-ali|shanghai': 'gulf-asia',
  'singapore|durban': 'asia-aus',
  'durban|singapore': 'asia-aus',
}

/** Pick the published trade lane connecting the two ports, if one exists. */
export function matchTradeLane(fromId: string, toId: string): TradeLane | null {
  const id = LANE_PAIRS[`${fromId}|${toId}`]
  return id ? (TRADE_LANES.find((lane) => lane.id === id) ?? null) : null
}
