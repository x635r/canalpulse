import { useMemo, type CSSProperties } from 'react'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Play,
  ShipWheel,
} from 'lucide-react'
import type { Chokepoint, MapMode, Vessel, VesselTypeId } from '../types'
import { everGiven, blockadeArchive } from '../data/blockade'
import { heatmapTotal, vesselTypes } from '../data/fleet'
import { formatMoney } from '../lib/geo'
import { deriveSummaryMetrics, type ChokepointTransits } from '../data/portwatch'

const typeOrder: VesselTypeId[] = ['container', 'bulk', 'lng', 'vlcc']
const bucketLabels = ['0–6H', '6–12H', '12–24H', '24H+']

function cellColor(count: number) {
  if (count === 0) return 'rgba(129, 161, 147, 0.035)'
  if (count >= 7) return 'rgba(255, 131, 104, 0.2)'
  if (count >= 4) return 'rgba(216, 184, 110, 0.15)'
  return 'rgba(104, 223, 195, 0.09)'
}

function cellTextColor(count: number) {
  if (count === 0) return 'rgba(189, 208, 197, 0.2)'
  if (count >= 7) return '#ffab93'
  if (count >= 4) return '#e4c984'
  return '#9ccec0'
}

export function QueuePanel({
  chokepoint,
  transits,
  portWatchLive,
}: {
  chokepoint: Chokepoint
  transits?: ChokepointTransits
  portWatchLive: boolean
}) {
  const maxCell = Math.max(...typeOrder.flatMap((type) => chokepoint.queueMatrix[type]))
  const total = heatmapTotal(chokepoint)
  const anchorages = [...chokepoint.anchorages].sort((a, b) => b.utilization - a.utilization)

  // Real transit counts from IMF PortWatch, when available.
  const derived = transits ? deriveSummaryMetrics(transits, chokepoint.summary.transitHours) : null

  return (
    <section className="rail-panel queue-panel">
      <div className="rail-panel-head">
        <div>
          <span className="eyebrow">ANCHORAGE PRESSURE / 锚地压港</span>
          <h3>{derived ? 'TRANSIT THROUGHPUT' : 'WAIT MATRIX'}</h3>
        </div>
        <span className={`panel-code ${portWatchLive ? 'is-live' : ''}`}>
          {portWatchLive ? 'PORTWATCH' : `QP-${chokepoint.index}`}
        </span>
      </div>

      {derived && transits ? (
        <>
          <div className="queue-headline">
            <div className="is-source">
              <strong>{transits.total.toLocaleString('en-US')}</strong>
              <span>ANNUAL TRANSITS</span>
            </div>
            <div className="is-source">
              <strong>{derived.dailyTransits}<small>/D</small></strong>
              <span>DAILY AVG</span>
            </div>
            <div>
              <strong>{derived.inWaterway}</strong>
              <span>IN WATERWAY · EST</span>
            </div>
          </div>

          <div className="transit-mix">
            <div className="transit-mix__head">
              <span>VESSEL MIX · 船型构成</span>
              <em>IMF PORTWATCH</em>
            </div>
            {[
              { key: 'container', label: 'Container', value: transits.container },
              { key: 'bulk', label: 'Dry bulk', value: transits.bulk },
              { key: 'vlcc', label: 'Tanker', value: transits.tanker },
              { key: 'lng', label: 'Gen cargo / RoRo', value: transits.generalCargo + transits.roro },
            ].map((row) => {
              const share = transits.total > 0 ? (row.value / transits.total) * 100 : 0
              return (
                <div className="transit-mix__row" key={row.key}>
                  <span className={`transit-mix__dot transit-mix__dot--${row.key}`} />
                  <span className="transit-mix__label">{row.label}</span>
                  <span className="transit-mix__bar">
                    <i style={{ width: `${share.toFixed(1)}%` }} />
                  </span>
                  <b>{row.value.toLocaleString('en-US')}</b>
                  <em>{share.toFixed(0)}%</em>
                </div>
              )
            })}
          </div>

          {transits.topIndustry && (
            <div className="transit-industry">
              <span>TOP TRADE</span>
              <strong>{transits.topIndustry}</strong>
            </div>
          )}
        </>
      ) : (
        <div className="queue-headline">
          <div>
            <strong>{total}</strong>
            <span>HELD AT ANCHOR</span>
          </div>
          <div>
            <strong>{chokepoint.summary.avgWaitHours.toFixed(1)}<small>H</small></strong>
            <span>MEAN DWELL</span>
          </div>
          <div>
            <strong>{chokepoint.summary.maxWaitHours.toFixed(1)}<small>H</small></strong>
            <span>LONGEST</span>
          </div>
        </div>
      )}

      <div className="heat-matrix">
        <div className="heat-matrix__grid">
          <span />
          {bucketLabels.map((label) => (
            <span className="heat-column-label" key={label}>{label}</span>
          ))}
          {typeOrder.map((type) => {
            const row = chokepoint.queueMatrix[type]
            const rowTotal = row.reduce((sum, value) => sum + value, 0)
            return (
              <div className="heat-row" key={type}>
                <span className="heat-row-label">
                  <i style={{ background: vesselTypes[type].color }} />
                  <span>
                    <strong>{vesselTypes[type].label}</strong>
                    <em>{vesselTypes[type].labelZh}</em>
                  </span>
                  <b>{rowTotal}</b>
                </span>
                {row.map((count, index) => (
                  <span
                    className={`heat-cell ${count === maxCell ? 'is-peak' : ''}`}
                    key={`${type}-${index}`}
                    style={{
                      background: cellColor(count),
                      color: cellTextColor(count),
                    }}
                    title={`${vesselTypes[type].label} · ${bucketLabels[index]} · ${count} vessels`}
                  >
                    {count || '·'}
                  </span>
                ))}
              </div>
            )
          })}
        </div>
        <div className="heat-legend">
          <span><i className="heat-key heat-key--low" /> LOW</span>
          <span><i className="heat-key heat-key--mid" /> BUILDING</span>
          <span><i className="heat-key heat-key--high" /> CRITICAL</span>
          <em>INTENSITY = HULL COUNT</em>
        </div>
      </div>

      <div className="anchorage-loads">
        {anchorages.slice(0, 2).map((anchorage) => (
          <div key={anchorage.id}>
            <span>
              <strong>{anchorage.name}</strong>
              <em>{anchorage.labelZh}</em>
            </span>
            <span className="load-bar">
              <i style={{ width: `${anchorage.utilization * 100}%` }} />
            </span>
            <b>{Math.round(anchorage.utilization * 100)}%</b>
          </div>
        ))}
      </div>
    </section>
  )
}

function clearanceTone(ukc: number, minimum: number) {
  if (ukc < minimum) {
    return {
      label: 'NO-GO',
      className: 'alert',
      note: 'Under-keel clearance below corridor minimum',
    }
  }
  if (ukc < minimum + 1.1) {
    return {
      label: 'CAUTION',
      className: 'warn',
      note: 'Reduced margin. Monitor squat and bank effect',
    }
  }
  return {
    label: 'SAFE',
    className: 'ok',
    note: 'Clearance within authorised transit envelope',
  }
}

function DepthSection({
  draft,
  chartDepth,
  tide,
  squat,
  ukc,
}: {
  draft: number
  chartDepth: number
  tide: number
  squat: number
  ukc: number
}) {
  const viewWidth = 320
  const top = 13
  const height = 84
  const maxDepth = Math.max(chartDepth + 4, draft + 7)
  const scale = height / maxDepth
  const keelY = top + draft * scale
  const seabedY = top + (chartDepth + tide) * scale
  const hullTop = keelY - 11
  const grounded = keelY >= seabedY
  // The clearance label sits in the gap between keel and seabed; when the hull
  // is deeper than the charted depth that gap inverts, so park it below.
  const ukcLabelY = grounded
    ? Math.max(keelY, seabedY) + 9
    : keelY + (seabedY - keelY) / 2 + 2

  return (
    <svg className="depth-section" viewBox={`0 0 ${viewWidth} 116`} aria-hidden="true">
      <defs>
        <linearGradient id="water-body" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0b2d29" stopOpacity=".95" />
          <stop offset="1" stopColor="#031310" stopOpacity=".98" />
        </linearGradient>
        <linearGradient id="seabed-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#5a4b32" />
          <stop offset="1" stopColor="#171a13" />
        </linearGradient>
      </defs>
      <rect x="0" y={top} width={viewWidth} height={height} fill="url(#water-body)" />
      <line x1="0" x2={viewWidth} y1={top} y2={top} className="depth-surface" />
      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
        <line
          key={fraction}
          x1="0"
          x2={viewWidth}
          y1={top + fraction * height}
          y2={top + fraction * height}
          className="depth-gridline"
        />
      ))}
      <path
        d={`M0 ${seabedY} C40 ${seabedY - 5} 82 ${seabedY + 2} 126 ${seabedY - 3} S226 ${seabedY + 4} 320 ${seabedY - 2} L320 116 L0 116Z`}
        fill="url(#seabed-fill)"
      />
      <path
        d={`M0 ${seabedY} C40 ${seabedY - 5} 82 ${seabedY + 2} 126 ${seabedY - 3} S226 ${seabedY + 4} 320 ${seabedY - 2}`}
        className="depth-seabed-line"
      />
      <rect
        x="78"
        y={hullTop}
        width="162"
        height={keelY - hullTop}
        rx="2"
        className="depth-hull"
      />
      <path
        d={`M90 ${hullTop - 7}h22v7H90zM218 ${hullTop - 8}h14v8h-14z`}
        className="depth-superstructure"
      />
      <path
        d={`M100 ${hullTop + 1}h28v4H100zM170 ${hullTop + 1}h28v4h-28zM201 ${hullTop + 1}h20v4h-20z`}
        className="depth-containers"
      />
      <line x1="78" x2="240" y1={keelY} y2={keelY} className="depth-keel-line" />
      <line x1="62" x2="264" y1={keelY} y2={keelY} className="depth-ukc-leader" />
      <line x1="264" x2="264" y1={keelY} y2={seabedY} className="depth-ukc-bracket" />
      <line x1="264" x2="264" y1={top} y2={seabedY} className="depth-depth-bracket" />
      <text x="6" y={Math.min(seabedY - 3, 108)} className="depth-seabed-label">
        SEABED
      </text>
      <text x="231" y={hullTop - 4} className="depth-note-label">
        DRAFT {draft.toFixed(1)}M
      </text>
      <text x="270" y={ukcLabelY} className={`depth-ukc-label ${grounded ? 'is-grounding' : ''}`}>
        {grounded ? `AGROUND ${Math.abs(ukc).toFixed(1)}M` : `UKC ${ukc.toFixed(1)}M`}
      </text>
      <text x="8" y="110" className="depth-small-label">
        CHART {chartDepth.toFixed(1)}M + TIDE {tide.toFixed(2)}M · SQUAT {squat.toFixed(2)}M
      </text>
    </svg>
  )
}

export function ChartProbe({
  chokepoint,
  selectedVessel,
  onCycleVessel,
  draft,
  onDraft,
}: {
  chokepoint: Chokepoint
  selectedVessel: Vessel
  onCycleVessel: (direction: -1 | 1) => void
  draft: number
  onDraft: (draft: number) => void
}) {
  const ukc = chokepoint.depth.chartDepth + chokepoint.depth.tidalAllowance - draft - chokepoint.depth.squat
  const tone = clearanceTone(ukc, chokepoint.depth.minUkc)
  const minDraft = 8
  const maxDraft = chokepoint.depth.chartDepth + 1.5

  return (
    <section className="rail-panel probe-panel">
      <div className="rail-panel-head">
        <div>
          <span className="eyebrow">CHART PROBE / 吃水与 UKC</span>
          <h3>UNDER-KEEL MARGIN</h3>
        </div>
        <div className="vessel-cycle">
          <button type="button" onClick={() => onCycleVessel(-1)} aria-label="Previous vessel">
            <ChevronLeft size={13} />
          </button>
          <span>VOYAGE</span>
          <button type="button" onClick={() => onCycleVessel(1)} aria-label="Next vessel">
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      <div className="probe-vessel">
        <span className={`probe-type-icon probe-type-icon--${selectedVessel.type}`}>
          <i />
        </span>
        <div>
          <strong>{selectedVessel.name}</strong>
          <span>
            {vesselTypes[selectedVessel.type].label} <i>·</i> {selectedVessel.flag} <i>·</i> IMO {selectedVessel.imo}
          </span>
        </div>
        <span className="probe-status">
          <i className={`tone-dot tone-dot--${tone.className === 'ok' ? 'ok' : tone.className === 'warn' ? 'warn' : 'alert'}`} />
          {tone.label}
        </span>
      </div>

      <DepthSection
        draft={draft}
        chartDepth={chokepoint.depth.chartDepth}
        tide={chokepoint.depth.tidalAllowance}
        squat={chokepoint.depth.squat}
        ukc={ukc}
      />

      <div className="ukc-readout">
        <div>
          <span>DRAFT / 吃水</span>
          <strong>{draft.toFixed(1)}<small>M</small></strong>
        </div>
        <div>
          <span>CHANNEL</span>
          <strong>{chokepoint.depth.chartDepth.toFixed(1)}<small>M</small></strong>
        </div>
        <div className={`ukc-value ukc-value--${tone.className}`}>
          <span>UKC / 富裕水深</span>
          <strong>{ukc.toFixed(2)}<small>M</small></strong>
        </div>
      </div>

      <div className="draft-slider">
        <div>
          <span>LOAD DRAFT SIMULATION</span>
          <em>MIN {chokepoint.depth.minUkc.toFixed(1)}M UKC</em>
        </div>
        <input
          type="range"
          min={minDraft}
          max={maxDraft}
          step="0.1"
          value={draft}
          aria-label="Simulated vessel draft"
          onChange={(event) => onDraft(Number(event.target.value))}
          style={
            {
              '--slider-progress': `${((draft - minDraft) / (maxDraft - minDraft)) * 100}%`,
            } as CSSProperties
          }
        />
        <div className="slider-scale">
          <span>{minDraft}M</span>
          <span>{((minDraft + maxDraft) / 2).toFixed(0)}M</span>
          <span>{maxDraft.toFixed(0)}M</span>
        </div>
      </div>

      <div className={`probe-note probe-note--${tone.className}`}>
        {tone.className === 'ok' ? <ShipWheel size={13} /> : <AlertTriangle size={13} />}
        <span>{tone.note}</span>
      </div>
    </section>
  )
}

export function ArchivePanel({
  mode,
  progress,
  onReplay,
  onModeChange,
}: {
  mode: MapMode
  progress: number
  onReplay: () => void
  onModeChange: (mode: MapMode) => void
}) {
  const active = mode === 'recon'
  const reconPulse = useMemo(() => Math.round(progress * 100), [progress])

  return (
    <section className={`rail-panel archive-panel ${active ? 'is-active' : ''}`}>
      <div className="rail-panel-head">
        <div>
          <span className="eyebrow">BLOCKADE ARCHIVE / 封锁档案</span>
          <h3>CLOSURE RECONSTRUCTION</h3>
        </div>
        <span className="archive-count">03</span>
      </div>

      <button type="button" className="featured-archive" onClick={onReplay}>
        <span className="featured-archive__stamp">RECON 001</span>
        <span className="featured-archive__year">2021</span>
        <span className="featured-archive__body">
          <span className="featured-archive__title">EVER GIVEN</span>
          <span className="featured-archive__sub">SUEZ CANAL · 长赐号横搁事件</span>
          <span className="featured-archive__stats">
            <span><em>HELD</em><strong>369</strong></span>
            <span><em>CLOSED</em><strong>6D 07H</strong></span>
            <span><em>LOSS</em><strong>{formatMoney(everGiven.costPerHour * everGiven.maxDurationHours)}</strong></span>
          </span>
        </span>
        <span className="featured-archive__action">
          {active ? (
            <>IN RECON {reconPulse}% <span className="archive-progress"><i style={{ width: `${reconPulse}%` }} /></span></>
          ) : (
            <>OPEN RECON <Play size={11} fill="currentColor" /></>
          )}
        </span>
        <span className="featured-archive__blocks" aria-hidden="true">
          <i /><i /><i /><i /><i />
        </span>
      </button>

      <div className="archive-list">
        {blockadeArchive
          .filter((entry) => !entry.featured)
          .map((entry) => (
            <div className="archive-row" key={entry.id}>
              <span className="archive-row__year">{entry.year}</span>
              <span className="archive-row__name">
                <strong>{entry.name}</strong>
                <em>{entry.label}</em>
              </span>
              <span className="archive-row__queue">{entry.queue} Q</span>
              <span className="archive-row__ref">REF</span>
            </div>
          ))}
      </div>

      {active && (
        <button type="button" className="archive-exit" onClick={() => onModeChange('flow')}>
          RETURN TO LIVE SITUATION
        </button>
      )}
    </section>
  )
}
