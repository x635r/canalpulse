/**
 * Traffic Separation Scheme (TSS) geometry.
 *
 * A TSS is defined by IMO COLREG Rule 10 and laid out in the relevant IMO
 * "Ships' Routeing" volume: a traffic lane in each direction, separated by a
 * separation zone or line, with inshore traffic zones outside the lanes.
 *
 * Why generate the band from the centreline rather than read it from OSM:
 * OSM carries TSS *symbols* in the OpenSeaMap raster layer, but not clean,
 * machine-readable lane polygons for every strait we track. Deriving a
 * symmetric lane pair from the charted centreline is the standard
 * cartographic construction, and the resulting geometry is honest about what
 * it is: a schematic at the published lane width, not a surveyed boundary.
 *
 * Published lane widths below come from the IMO routeing measures for each
 * scheme. Where a scheme uses a separation zone rather than a line, the zone
 * width is given.
 */

import type { LngLat } from '../types'
import { bearingBetween } from './geo'

export interface TssSpec {
  /** Total width of each directional lane, metres. */
  laneWidthM: number
  /** Width of the separation zone between lanes, metres (0 = separation line). */
  separationM: number
  /** Which side carries the inbound traffic, from the charted direction. */
  inboundSide: 'left' | 'right'
  /** Approximate published source for the width figure. */
  source: string
  note: string
}

/**
 * Lane geometry per strait. These follow the IMO-adopted routeing measures;
 * widths are rounded to the published figures.
 */
export const TSS_SPECS: Partial<Record<string, TssSpec>> = {
  dover: {
    laneWidthM: 5000,
    separationM: 1000,
    inboundSide: 'right',
    source: 'IMO Ships\' Routeing — Dover Strait TSS',
    note: 'Two 5 km lanes separated by a 1 km zone; the busiest TSS in the world.',
  },
  gibraltar: {
    laneWidthM: 5000,
    separationM: 2000,
    inboundSide: 'right',
    source: 'IMO Ships\' Routeing — Gibraltar Strait TSS',
    note: 'Lanes follow the Camarinal Sill axis with a 2 km separation zone.',
  },
  hormuz: {
    laneWidthM: 5000,
    separationM: 3000,
    inboundSide: 'right',
    source: 'IMO Ships\' Routeing — Strait of Hormuz TSS',
    note: 'Lanes route around Musandam with a wide separation zone.',
  },
  malacca: {
    laneWidthM: 3700,
    separationM: 1000,
    inboundSide: 'right',
    source: 'IMO Ships\' Routeing — Malacca and Singapore Straits TSS',
    note: 'Lane width narrows to 3.7 km in the Singapore Strait sector.',
  },
  'bab-el-mandeb': {
    laneWidthM: 2000,
    separationM: 500,
    inboundSide: 'right',
    source: 'IMO Ships\' Routeing — Bab-el-Mandeb TSS',
    note: 'Narrow lanes through Perim Narrows.',
  },
  bosphorus: {
    laneWidthM: 700,
    separationM: 0,
    inboundSide: 'right',
    source: 'Turkish Straits traffic scheme',
    note: 'Single one-way convoy through a 700 m channel; no TSS lanes.',
  },
  suez: {
    laneWidthM: 205,
    separationM: 0,
    inboundSide: 'right',
    source: 'Suez Canal Authority',
    note: 'Convoy operation in a 205 m channel; passing occurs in the bypasses.',
  },
  panama: {
    laneWidthM: 192,
    separationM: 0,
    inboundSide: 'right',
    source: 'Panama Canal Authority',
    note: 'Lock chambers govern; lanes are the chamber width.',
  },
}

/** Offset a point perpendicular to a bearing by a distance in metres. */
function offsetPoint(point: LngLat, bearingDeg: number, distanceM: number): LngLat {
  const R = 6371000
  const bearing = (bearingDeg * Math.PI) / 180
  const lat1 = (point[1] * Math.PI) / 180
  const lng1 = (point[0] * Math.PI) / 180
  const d = distanceM / R

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing),
  )
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    )

  return [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]
}

/**
 * Build the lane polygons for a TSS.
 *
 * Returns three ribbons: inbound lane, outbound lane, and the separation zone
 * between them. Each is a closed ring suitable for a MapLibre fill layer.
 */
export function buildTssGeometry(
  centreline: LngLat[],
  spec: TssSpec,
): {
  inbound: LngLat[]
  outbound: LngLat[]
  separation: LngLat[]
} {
  const halfLane = spec.laneWidthM / 2
  const halfSep = spec.separationM / 2
  const totalOffset = halfSep + halfLane

  const leftEdge: LngLat[] = []
  const rightEdge: LngLat[] = []
  const sepLeft: LngLat[] = []
  const sepRight: LngLat[] = []

  for (let index = 0; index < centreline.length; index += 1) {
    const point = centreline[index]
    // Use the local course so the band follows the waterway bends.
    const ahead = centreline[Math.min(index + 1, centreline.length - 1)]
    const behind = centreline[Math.max(index - 1, 0)]
    const course = bearingBetween(behind, ahead)

    // Port side is course - 90, starboard is course + 90.
    leftEdge.push(offsetPoint(point, course - 90, totalOffset))
    rightEdge.push(offsetPoint(point, course + 90, totalOffset))

    if (halfSep > 0) {
      sepLeft.push(offsetPoint(point, course - 90, halfSep))
      sepRight.push(offsetPoint(point, course + 90, halfSep))
    }
  }

  const inboundSide = spec.inboundSide === 'right' ? rightEdge : leftEdge
  const outboundSide = spec.inboundSide === 'right' ? leftEdge : rightEdge
  const centre = centreline

  return {
    inbound: [...inboundSide, ...[...centre].reverse()],
    outbound: [...centre, ...[...outboundSide].reverse()],
    separation:
      halfSep > 0 ? [...sepRight, ...[...sepLeft].reverse()] : [...sepRight, ...[...sepLeft].reverse()],
  }
}

/** True when the waterway has a real two-way TSS rather than a single channel. */
export function hasTss(chokepointId: string): boolean {
  const spec = TSS_SPECS[chokepointId]
  return Boolean(spec && spec.separationM > 0)
}
