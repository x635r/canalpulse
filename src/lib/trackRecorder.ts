/**
 * AIS track recorder and playback.
 *
 * Digitraffic publishes only the latest position per vessel — there is no
 * historical track endpoint (verified: /tracks returns 404, and /locations with
 * a past `from` timestamp returns an empty collection). Paid providers sell
 * history, but nothing free does.
 *
 * So the track is accumulated locally while the operator watches: each poll
 * appends a point per vessel, and the recorder keeps a rolling window in
 * memory. That makes playback an honest record of what this session actually
 * observed, rather than a fabricated reconstruction.
 */

export interface TrackPoint {
  t: number
  lon: number
  lat: number
  sog: number
  cog: number
}

export interface VesselTrack {
  mmsi: string
  name: string
  color: string
  points: TrackPoint[]
}

/** How long a track is retained before old points are dropped. */
export const TRACK_WINDOW_MS = 60 * 60 * 1000
/** Points closer together than this are skipped to bound memory. */
const MIN_SAMPLE_GAP_MS = 20 * 1000

export class TrackRecorder {
  private tracks = new Map<string, VesselTrack>()

  /** Append the current positions, deduplicating by station and time. */
  record(
    vessels: { mmsi: string; name: string; position?: [number, number]; speed: number; heading: number; type: string }[],
    colors: Record<string, string>,
    now = Date.now(),
  ) {
    for (const vessel of vessels) {
      if (!vessel.position) continue
      const [lon, lat] = vessel.position
      let track = this.tracks.get(vessel.mmsi)
      if (!track) {
        track = { mmsi: vessel.mmsi, name: vessel.name, color: colors[vessel.type] ?? '#68dfc3', points: [] }
        this.tracks.set(vessel.mmsi, track)
      }

      const last = track.points[track.points.length - 1]
      if (last && now - last.t < MIN_SAMPLE_GAP_MS) {
        // Update the newest sample in place so the playback head stays live.
        last.lon = lon
        last.lat = lat
        last.sog = vessel.speed
        last.cog = vessel.heading
        continue
      }
      track.points.push({ t: now, lon, lat, sog: vessel.speed, cog: vessel.heading })
    }

    // Drop anything outside the retention window.
    const cutoff = now - TRACK_WINDOW_MS
    for (const [mmsi, track] of this.tracks) {
      if (track.points.length === 0) continue
      if (track.points[track.points.length - 1].t < cutoff) {
        this.tracks.delete(mmsi)
        continue
      }
      const firstValid = track.points.findIndex((p) => p.t >= cutoff)
      if (firstValid > 0) track.points = track.points.slice(firstValid)
    }
  }

  /** Tracks with at least two points, which is the minimum that can be drawn. */
  drawable(): VesselTrack[] {
    return [...this.tracks.values()].filter((track) => track.points.length >= 2)
  }

  /** All tracks, including single-point ones (for the live tail). */
  all(): VesselTrack[] {
    return [...this.tracks.values()]
  }

  /** Time span actually covered, for the scrubber bounds. */
  span(): { start: number; end: number } | null {
    let start = Number.POSITIVE_INFINITY
    let end = 0
    for (const track of this.tracks.values()) {
      if (track.points.length === 0) continue
      start = Math.min(start, track.points[0].t)
      end = Math.max(end, track.points[track.points.length - 1].t)
    }
    if (!Number.isFinite(start) || end === 0) return null
    return { start, end }
  }

  clear() {
    this.tracks.clear()
  }
}

/** Positions at or before `time`, one per vessel — the playback frame. */
export function frameAt(tracks: VesselTrack[], time: number): { track: VesselTrack; point: TrackPoint }[] {
  const frame: { track: VesselTrack; point: TrackPoint }[] = []
  for (const track of tracks) {
    let picked: TrackPoint | null = null
    for (const point of track.points) {
      if (point.t <= time) picked = point
      else break
    }
    if (picked) frame.push({ track, point: picked })
  }
  return frame
}
