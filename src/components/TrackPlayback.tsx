import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { TrackRecorder, frameAt, type VesselTrack } from '../lib/trackRecorder'
import type { Vessel } from '../types'
import { vesselTypes } from '../data/fleet'

/**
 * AIS track playback.
 *
 * The recorder collects every position this session has observed. Playback is
 * therefore a review of real observed telemetry, not a reconstruction — which
 * is the only honest option given that the free feed keeps no history.
 */
export function TrackPlayback({
  liveVessels,
  active,
  onFrame,
}: {
  liveVessels: Vessel[]
  /** Whether live AIS is currently being polled. */
  active: boolean
  /** Called with the frame to render, or null to return to live. */
  onFrame: (frame: { mmsi: string; lon: number; lat: number }[] | null) => void
}) {
  const recorderRef = useRef(new TrackRecorder())
  const [tracks, setTracks] = useState<VesselTrack[]>([])
  const [span, setSpan] = useState<{ start: number; end: number } | null>(null)
  const [cursor, setCursor] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Feed every poll into the recorder.
  useEffect(() => {
    if (!active) return
    const colors = Object.fromEntries(
      Object.entries(vesselTypes).map(([key, meta]) => [key, meta.color]),
    )
    recorderRef.current.record(
      liveVessels.map((v) => ({
        mmsi: v.mmsi,
        name: v.name,
        position: v.position,
        speed: v.speed,
        heading: v.heading,
        type: v.type,
      })),
      colors,
    )
    setTracks(recorderRef.current.drawable())
    setSpan(recorderRef.current.span())
  }, [liveVessels, active])

  // Playback clock.
  useEffect(() => {
    if (!playing || !span) return
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = now - last
      last = now
      setCursor((value) => {
        // Play the recorded window back over ~30 seconds.
        const next = value + (dt / 30_000) * 100
        if (next >= 100) {
          setPlaying(false)
          return 100
        }
        return next
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, span])

  // Push the selected frame up to the map.
  useEffect(() => {
    if (!span || tracks.length === 0) return
    if (cursor >= 99.9) {
      onFrame(null)
      return
    }
    const time = span.start + ((span.end - span.start) * cursor) / 100
    const frame = frameAt(tracks, time)
    onFrame(frame.map((f) => ({ mmsi: f.track.mmsi, lon: f.point.lon, lat: f.point.lat })))
  }, [cursor, span, tracks, onFrame])

  const points = useMemo(() => tracks.reduce((sum, t) => sum + t.points.length, 0), [tracks])
  const windowMin = span ? Math.round((span.end - span.start) / 60000) : 0

  if (tracks.length === 0) {
    return (
      <section className="track-panel">
        <header className="track-panel__head">
          <span>TRACK PLAYBACK / 轨迹回放</span>
          <em className="track-panel__idle">
            {active ? '采集中…' : '需先开启 LIVE AIS'}
          </em>
        </header>
        <p className="track-panel__hint">
          Digitraffic 只发布最新船位、不保留历史轨迹，因此回放基于本会话实际观测到的位置累积。
          保持 LIVE AIS 开启即可逐步积累航迹。
        </p>
      </section>
    )
  }

  return (
    <section className={`track-panel ${expanded ? 'is-expanded' : ''}`}>
      <header className="track-panel__head">
        <button type="button" onClick={() => setExpanded((v) => !v)}>
          <span>TRACK PLAYBACK / 轨迹回放</span>
          <em>{tracks.length} 船 · {points} 点 · {windowMin} 分钟</em>
        </button>
      </header>

      <div className="track-panel__body">
        <div className="track-controls">
          <button
            type="button"
            className="track-play"
            onClick={() => {
              if (cursor >= 99.9) setCursor(0)
              setPlaying((v) => !v)
            }}
            aria-label={playing ? '暂停回放' : '播放回放'}
          >
            {playing ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            step="0.5"
            value={cursor}
            aria-label="轨迹时间轴"
            onChange={(e) => {
              setPlaying(false)
              setCursor(Number(e.target.value))
            }}
          />
          <button
            type="button"
            className="track-reset"
            onClick={() => {
              setPlaying(false)
              setCursor(100)
              onFrame(null)
            }}
            aria-label="回到实时"
          >
            <RotateCcw size={11} />
          </button>
        </div>

        <div className="track-legend">
          <span>
            {cursor >= 99.9 ? 'LIVE' : `T-${Math.round(((100 - cursor) / 100) * windowMin)}min`}
          </span>
          <em>{span ? new Date(span.start).toISOString().slice(11, 16) : '--:--'} → {span ? new Date(span.end).toISOString().slice(11, 16) : '--:--'}Z</em>
        </div>
      </div>
    </section>
  )
}
