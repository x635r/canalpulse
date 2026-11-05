import { Waves } from 'lucide-react'
import type { TideForecast } from '../data/tides'
import { findTideWindows } from '../data/tides'

/**
 * Tide window readout for the selected waterway.
 *
 * Shows the real CO-OPS hourly curve where one exists, and states plainly why
 * no curve is shown where it does not. It also answers the operational
 * question a UKC model is actually asked: which hours today give enough water.
 */
export function TideWindow({
  forecast,
  requiredTide,
  vesselDraft,
}: {
  forecast: TideForecast | null
  /** Tide height needed to satisfy the UKC requirement, metres. */
  requiredTide: number
  vesselDraft: number
}) {
  if (!forecast) {
    return (
      <section className="rail-panel tide-panel">
        <div className="rail-panel-head">
          <div>
            <span className="eyebrow">TIDAL WINDOW / 潮汐窗口</span>
            <h3>TIDE ASSESSMENT</h3>
          </div>
          <span className="panel-code">SYNC</span>
        </div>
        <p className="tide-panel__pending">潮汐预报载入中…</p>
      </section>
    )
  }

  const available = forecast.status === 'available'
  const windows = available ? findTideWindows(forecast, requiredTide) : []

  // Normalise the curve to the panel height for a compact sparkline.
  const chartH = 34
  const chartW = 100
  const path = available
    ? forecast.points
        .map((point, index) => {
          const x = (index / Math.max(forecast.points.length - 1, 1)) * chartW
          const span = forecast.highWater - forecast.lowWater || 1
          const y = chartH - ((point.height - forecast.lowWater) / span) * chartH
          return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
        })
        .join(' ')
    : ''

  return (
    <section className="rail-panel tide-panel">
      <div className="rail-panel-head">
        <div>
          <span className="eyebrow">TIDAL WINDOW / 潮汐窗口</span>
          <h3>TIDE ASSESSMENT</h3>
        </div>
        <span className={`panel-code ${available ? 'is-live' : ''}`}>
          {available ? 'CO-OPS' : 'NO SOURCE'}
        </span>
      </div>

      {available ? (
        <>
          <div className="tide-panel__station">
            <span>
              <Waves size={10} /> {forecast.stationName}
            </span>
            <em>{forecast.station} · {forecast.datum}</em>
          </div>

          <svg
            className="tide-curve"
            viewBox={`0 0 ${chartW} ${chartH}`}
            preserveAspectRatio="none"
            aria-label="48 小时潮高曲线"
          >
            <line
              x1="0"
              x2={chartW}
              y1={chartH - ((requiredTide - forecast.lowWater) / (forecast.highWater - forecast.lowWater || 1)) * chartH}
              y2={chartH - ((requiredTide - forecast.lowWater) / (forecast.highWater - forecast.lowWater || 1)) * chartH}
              className="tide-curve__threshold"
            />
            <path d={path} className="tide-curve__line" />
          </svg>

          <div className="tide-panel__range">
            <span>LW {forecast.lowWater.toFixed(2)}m</span>
            <span className="tide-panel__need">
              {requiredTide <= 0.01 ? '无需候潮' : `需 ${requiredTide.toFixed(2)}m`}
            </span>
            <span>HW {forecast.highWater.toFixed(2)}m</span>
          </div>

          <div className="tide-windows">
            {requiredTide <= 0.01 ? (
              <div className="tide-window">
                <span className="tide-window__ok">全潮位可通航</span>
                <strong>当前吃水低于控制水深</strong>
                <em>无需候潮窗口</em>
              </div>
            ) : windows.length > 0 ? (
              windows.slice(0, 2).map((w) => (
                <div className="tide-window" key={w.start}>
                  <span className="tide-window__ok">可通航</span>
                  <strong>
                    {w.start.slice(5)} → {w.end.slice(11)}
                  </strong>
                  <em>峰值 {w.peak.toFixed(2)}m</em>
                </div>
              ))
            ) : (
              <div className="tide-window tide-window--none">
                <span>48 小时内无满足 {requiredTide.toFixed(2)}m 的潮位窗口</span>
                <em>吃水 {vesselDraft.toFixed(1)}m 需减载或候潮</em>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="tide-panel__unavailable">
          <strong>无权威潮汐预报</strong>
          <p>{forecast.note}</p>
          <em>UKC 计算使用固定潮位余量，建议以官方潮汐表为准。</em>
        </div>
      )}
    </section>
  )
}
