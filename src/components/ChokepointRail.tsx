import { ArrowUpRight, ChevronRight, RadioTower } from 'lucide-react'
import type { Chokepoint, ChokepointId } from '../types'
import { chokepoints, networkPressure, networkTotals } from '../data/chokepoints'
import type { TransitMap } from '../data/portwatch'
import { ChokeGlyph, Sparkline, ToneDot } from './Primitives'

function pressureBand(pressure: number) {
  if (pressure >= 78) return 2
  if (pressure >= 55) return 1
  return 0
}

function PressureGauge({ pressure }: { pressure: number }) {
  const radius = 55
  const circumference = 2 * Math.PI * radius
  const progress = circumference * (pressure / 100)
  const band = pressureBand(pressure)
  const bandLabel = ['NOMINAL', 'ELEVATED', 'CRITICAL'][band]

  return (
    <div className="pressure-gauge">
      <svg viewBox="0 0 180 180" aria-hidden="true">
        <circle className="gauge-grid" cx="90" cy="90" r="78" />
        <circle className="gauge-grid gauge-grid--inner" cx="90" cy="90" r="69" />
        {Array.from({ length: 72 }).map((_, index) => {
          const major = index % 6 === 0
          const danger = index >= 50
          return (
            <line
              key={index}
              className={`gauge-tick ${major ? 'gauge-tick--major' : ''} ${danger ? 'gauge-tick--danger' : ''}`}
              x1="90"
              y1={major ? 10 : 12}
              x2="90"
              y2={major ? 17 : 15}
              transform={`rotate(${index * 5} 90 90)`}
            />
          )
        })}
        <circle className="gauge-track" cx="90" cy="90" r={radius} />
        <circle
          className="gauge-progress"
          cx="90"
          cy="90"
          r={radius}
          strokeDasharray={`${progress} ${circumference}`}
          transform="rotate(-90 90 90)"
        />
        <circle className="gauge-terminal" cx="90" cy="35" r="2.2" />
        <g transform={`rotate(${pressure * 3.6} 90 90)`}>
          <path className="gauge-needle" d="M90 48 94 88 90 94 86 88Z" />
        </g>
        <circle className="gauge-hub" cx="90" cy="90" r="5.4" />
        <circle className="gauge-hub-inner" cx="90" cy="90" r="2" />
        <text className="gauge-small-label" x="90" y="62" textAnchor="middle">
          COMPOSITE
        </text>
        <text className="gauge-value" x="90" y="88" textAnchor="middle">
          {pressure.toFixed(1)}
        </text>
        <text className="gauge-unit" x="90" y="101" textAnchor="middle">
          STRESS %
        </text>
        <text className="gauge-scale-label" x="90" y="121" textAnchor="middle">
          {bandLabel}
        </text>
      </svg>
      <div className="gauge-footer">
        {['NOMINAL', 'ELEVATED', 'CRITICAL'].flatMap((label, index) => {
          const node = (
            <span
              key={label}
              className={index === band ? 'is-live' : ''}
              style={index === band ? undefined : { opacity: 0.45 }}
            >
              {label}
            </span>
          )
          return index === 0 ? [node] : [<i key={`${label}-sep`} />, node]
        })}
      </div>
    </div>
  )
}

export function ChokepointRail({
  activeId,
  onSelect,
  onOpenSources,
  transits,
}: {
  activeId: ChokepointId
  onSelect: (chokepoint: Chokepoint) => void
  onOpenSources: () => void
  transits: TransitMap
}) {
  const totalActive = networkTotals.active
  const totalQueue = networkTotals.queue
  const totalThroughput = networkTotals.throughput
  const pressure = networkPressure

  return (
    <aside className="left-rail">
      <div className="rail-heading">
        <div>
          <span className="eyebrow">GLOBAL CHOKEPOINT INDEX</span>
          <h2>CHOKEPOINT INDEX</h2>
        </div>
        <span className="rail-count">
          {String(chokepoints.length).padStart(2, '0')} / {String(chokepoints.length).padStart(2, '0')}
        </span>
      </div>

      <div className="choke-list">
        {chokepoints.map((chokepoint) => {
          const isActive = chokepoint.id === activeId
          return (
            <button
              className={`choke-card ${isActive ? 'is-active' : ''}`}
              key={chokepoint.id}
              type="button"
              onClick={() => onSelect(chokepoint)}
              aria-pressed={isActive}
            >
              <span className="choke-card__accent" />
              <span className="choke-card__index">{chokepoint.index}</span>
              <ChokeGlyph id={chokepoint.id} />
              <span className="choke-card__content">
                <span className="choke-card__title-row">
                  <span className="choke-card__title">{chokepoint.name}</span>
                  <span
                    className={`status-chip status-chip--${chokepoint.tone}`}
                    title={chokepoint.status}
                  >
                    <ToneDot tone={chokepoint.tone} />
                    {chokepoint.status}
                  </span>
                </span>
                <span className="choke-card__zh">
                  {chokepoint.nameZh} <i>·</i> {chokepoint.region}
                </span>
                <span className="choke-card__metrics">
                  {transits[chokepoint.id] ? (
                    <>
                      <span>
                        <em>TRANSITS</em>
                        <strong>{transits[chokepoint.id]!.total.toLocaleString('en-US')}</strong>
                      </span>
                      <span>
                        <em>PER DAY</em>
                        <strong>
                          {(transits[chokepoint.id]!.total / 365).toFixed(1)}
                        </strong>
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        <em>QUEUE</em>
                        <strong>{chokepoint.summary.queue}</strong>
                      </span>
                      <span>
                        <em>WAIT</em>
                        <strong>
                          {chokepoint.summary.avgWaitHours.toFixed(1)}
                          <small>H</small>
                        </strong>
                      </span>
                    </>
                  )}
                  <Sparkline
                    data={chokepoint.spark}
                    color={
                      chokepoint.tone === 'alert'
                        ? '#ff8368'
                        : chokepoint.tone === 'ok'
                          ? '#68dfc3'
                          : '#d8b86e'
                    }
                    width={72}
                    height={27}
                  />
                </span>
              </span>
              <ChevronRight className="choke-card__chevron" size={13} strokeWidth={1.5} />
            </button>
          )
        })}
      </div>

      <div className="rail-watch">
        <div className="rail-watch__head">
          <span className="eyebrow">WATCHLIST / 运行值守</span>
          <em>03 ACTIVE</em>
        </div>
        <div className="rail-watch__row">
          <span className="watch-index">01</span>
          <span className="watch-copy">
            <strong>SUEZ · AUTHORISED DRAFT</strong>
            <em>SCA circular 04/2026 · 20.10m limit</em>
          </span>
          <span className="watch-tag watch-tag--warn">WATCH</span>
        </div>
        <div className="rail-watch__row">
          <span className="watch-index">02</span>
          <span className="watch-copy">
            <strong>PANAMA · GATUN LEVEL</strong>
            <em>24.62m reservoir · slot auction live</em>
          </span>
          <span className="watch-tag watch-tag--alert">ALERT</span>
        </div>
        <div className="rail-watch__row">
          <span className="watch-index">03</span>
          <span className="watch-copy">
            <strong>BOSPHORUS · VISIBILITY</strong>
            <em>Southbound convoy +00:42 delay</em>
          </span>
          <span className="watch-tag watch-tag--watch">WATCH</span>
        </div>
      </div>

      <div className="rail-block rail-block--gauge">
        <div className="rail-block__heading">
          <span className="eyebrow">NETWORK PULSE / 网络脉搏</span>
          <span className="pulse-wave">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        <PressureGauge pressure={pressure} />
        <div className="global-readouts">
          <div>
            <span>UNDERWAY</span>
            <strong>{totalActive.toLocaleString('en-US')}</strong>
          </div>
          <div>
            <span>AT ANCHOR</span>
            <strong>{totalQueue}</strong>
          </div>
          <div>
            <span>TRANSIT / D</span>
            <strong>{totalThroughput}</strong>
          </div>
        </div>
      </div>

      <div className="rail-block rail-block--sources">
        <button type="button" className="source-link" onClick={onOpenSources}>
          <RadioTower size={14} strokeWidth={1.5} />
          <span>
            <strong>SOURCE MATRIX</strong>
            <em>AIS · GEBCO · EMODnet · OPEN-METEO</em>
          </span>
          <ArrowUpRight size={13} strokeWidth={1.5} />
        </button>
        <div className="source-health">
          <span>
            <i className="source-dot source-dot--live" />
            WMS LIVE
          </span>
          <span>
            <i className="source-dot source-dot--replay" />
            AIS REPLAY
          </span>
          <span>
            <i className="source-dot source-dot--live" />
            WX LIVE
          </span>
        </div>
      </div>

      <div className="rail-footer">
        <span>CP–OS / REV 1.4.2</span>
        <span>SYNC 06:42:18Z</span>
      </div>
    </aside>
  )
}
