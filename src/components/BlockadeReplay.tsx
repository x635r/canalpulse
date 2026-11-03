import { useEffect, useMemo, useRef } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  X,
} from 'lucide-react'
import { everGiven } from '../data/blockade'
import { getReconState } from '../lib/blockade'
import { formatMoney } from '../lib/geo'

export function BlockadeReplay({
  progress,
  onProgress,
  playing,
  onPlaying,
  onExit,
}: {
  progress: number
  onProgress: (value: number) => void
  playing: boolean
  onPlaying: (value: boolean) => void
  onExit: () => void
}) {
  const state = getReconState(progress)
  const chartRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(progress)

  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let lastPaint = 0
    let animated = progressRef.current
    const loop = (time: number) => {
      const delta = Math.min(0.08, (time - last) / 1000)
      last = time
      animated = Math.min(1, animated + delta * 0.028)
      if (animated >= 1) {
        onProgress(1)
        onPlaying(false)
        return
      }
      if (time - lastPaint >= 70) {
        onProgress(animated)
        lastPaint = time
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing, onProgress, onPlaying])

  const { path, area, points } = useMemo(() => {
    const width = 760
    const height = 148
    const max = 390
    const list = everGiven.backlog.map((point, index) => {
      const x = (index / (everGiven.backlog.length - 1)) * width
      const y = height - (point.queue / max) * (height - 20) - 8
      return [x, y] as const
    })
    const d = list
      .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ')
    return {
      path: d,
      area: `${d} L760,${height} L0,${height} Z`,
      points: list,
    }
  }, [])

  const currentIndex = useMemo(() => {
    const raw = progress * (everGiven.backlog.length - 1)
    return Math.max(0, Math.min(everGiven.backlog.length - 1, Math.round(raw)))
  }, [progress])

  const jumpEvent = (direction: -1 | 1) => {
    const events = everGiven.events
    const current = events.findIndex((event) => event.at === state.event.at)
    const nextIndex = Math.max(0, Math.min(events.length - 1, current + direction))
    onProgress(events[nextIndex].at)
    onPlaying(false)
  }

  const scrub = (clientX: number) => {
    const rect = chartRef.current?.getBoundingClientRect()
    if (!rect) return
    const value = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    onProgress(value)
    onPlaying(false)
  }

  return (
    <section className="replay-dock panel-sheen">
      <header className="dock-header">
        <div className="dock-title replay-title">
          <span className="eyebrow">BLOCKADE RECON / 历史封锁推演</span>
          <h3>EVER GIVEN · SUEZ CANAL <span>EXERCISE</span></h3>
        </div>
        <div className="replay-status">
          <span className="archive-badge">ARCHIVE / 2021</span>
          <span className={`replay-phase replay-phase--${state.phase.toLowerCase()}`}>
            <i />
            {state.phase}
          </span>
        </div>
        <div className="dock-actions">
          <button type="button" className="dock-utility" onClick={() => jumpEvent(-1)} aria-label="Previous event">
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            className="play-button"
            onClick={() => {
              if (progress >= 1) onProgress(0)
              onPlaying(!playing)
            }}
            aria-label={playing ? 'Pause replay' : 'Play replay'}
          >
            {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          </button>
          <button type="button" className="dock-utility" onClick={() => jumpEvent(1)} aria-label="Next event">
            <ChevronRight size={15} />
          </button>
          <button
            type="button"
            className="dock-utility"
            onClick={() => {
              onProgress(0)
              onPlaying(false)
            }}
            aria-label="Reset replay"
          >
            <RotateCcw size={14} />
          </button>
          <button type="button" className="exit-recon" onClick={onExit}>
            <X size={13} /> EXIT RECON
          </button>
        </div>
      </header>

      <div className="replay-body">
        <aside className="replay-summary">
          <div className="replay-date">
            <span>{everGiven.startLabel.split(' · ')[0]}</span>
            <strong>{state.dayLabel}</strong>
            <em>T+{state.elapsedHours.toFixed(1)} HRS</em>
          </div>
          <div className="replay-event">
            <span>{state.event.time} / {state.event.titleZh}</span>
            <strong>{state.event.title}</strong>
            <p>{state.event.detail}</p>
          </div>
          <div className="replay-figures">
            <span><em>QUEUE</em><strong>{state.queue}</strong><i>/ 369</i></span>
            <span><em>COST</em><strong>{formatMoney(state.cost)}</strong><i>Σ</i></span>
            <span><em>TRANSIT</em><strong>{state.throughput}</strong><i>/ DAY</i></span>
          </div>
        </aside>

        <div className="replay-chart-wrap">
          <div className="replay-chart-head">
            <span>BACKLOG / 滞留船舶</span>
            <span className="replay-legend"><i /> AIS-derived backlog <em>·</em> {everGiven.ship} / IMO {everGiven.imo}</span>
          </div>
          <div
            className="replay-chart"
            ref={chartRef}
            onPointerDown={(event) => scrub(event.clientX)}
            onPointerMove={(event) => {
              if (event.buttons === 1) scrub(event.clientX)
            }}
            role="slider"
            tabIndex={0}
            aria-label="Blockade replay timeline"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') onProgress(Math.min(1, progress + 0.02))
              if (event.key === 'ArrowLeft') onProgress(Math.max(0, progress - 0.02))
            }}
          >
            <svg viewBox="0 0 760 148" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="backlog-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#ff7f5f" stopOpacity=".26" />
                  <stop offset="1" stopColor="#ff7f5f" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3].map((index) => (
                <line
                  key={index}
                  x1="0"
                  x2="760"
                  y1={12 + index * 39}
                  y2={12 + index * 39}
                  className="chart-gridline"
                />
              ))}
              <path d={area} fill="url(#backlog-fill)" />
              <path d={path} className="backlog-path" />
              {everGiven.events.map((event) => (
                <g key={event.at}>
                  <line
                    x1={event.at * 760}
                    x2={event.at * 760}
                    y1="8"
                    y2="140"
                    className="event-guide"
                  />
                  <circle
                    cx={event.at * 760}
                    cy={points[Math.round(event.at * (points.length - 1))][1]}
                    r="3.5"
                    className="event-node"
                  />
                </g>
              ))}
              <line
                x1={progress * 760}
                x2={progress * 760}
                y1="4"
                y2="145"
                className="current-guide"
              />
              <circle
                cx={progress * 760}
                cy={points[currentIndex][1]}
                r="5.4"
                className="current-node"
              />
            </svg>
            <div className="replay-yaxis">
              <span>369</span>
              <span>240</span>
              <span>120</span>
              <span>0</span>
            </div>
            <div className="replay-xaxis">
              {everGiven.backlog.map((point) => (
                <span key={point.label}>{point.label}</span>
              ))}
            </div>
            <div className="replay-events">
              {everGiven.events.map((event) => (
                <span key={event.at} style={{ left: `${event.at * 100}%` }}>
                  {event.title}
                </span>
              ))}
            </div>
          </div>
          <div className="replay-timeline">
            <span>MAR 23</span>
            <div className="timeline-track">
              <input
                type="range"
                min="0"
                max="100"
                step="0.5"
                value={progress * 100}
                aria-label="Replay scrubber"
                onChange={(event) => {
                  onPlaying(false)
                  onProgress(Number(event.target.value) / 100)
                }}
              />
              <span className="timeline-fill" style={{ width: `${progress * 100}%` }} />
            </div>
            <span>APR 04</span>
          </div>
        </div>

        <aside className="replay-metrics">
          <div>
            <span>PEAK QUEUE</span>
            <strong>{everGiven.peakQueue}</strong>
            <em>VESSELS</em>
          </div>
          <div>
            <span>TRADE SHARE</span>
            <strong>{everGiven.tradeShare}<small>%</small></strong>
            <em>WORLD TRADE</em>
          </div>
          <div>
            <span>LOSS / HOUR</span>
            <strong>${Math.round(everGiven.costPerHour / 1_000_000)}<small>M</small></strong>
            <em>ESTIMATE</em>
          </div>
          <div>
            <span>BLOCKED</span>
            <strong>6<small>D 07H</small></strong>
            <em>CANAL CLOSED</em>
          </div>
        </aside>
      </div>
    </section>
  )
}
