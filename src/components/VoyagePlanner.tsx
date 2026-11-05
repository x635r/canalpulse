import { useMemo, useState } from 'react'
import { Anchor, Clock, Route as RouteIcon } from 'lucide-react'
import { PLAN_PORTS, crossTrackNm, formatDuration, matchTradeLane, planVoyage } from '../lib/voyage'
import { chokepoints } from '../data/chokepoints'
import type { TransitMap } from '../data/portwatch'

/**
 * Voyage planner: pick two ports, get distance, waterway delays and an ETA
 * broken down into steaming time versus waiting time.
 *
 * The route is a great-circle sum over the ports plus any intervening waterway
 * the great circle passes near. It is a planning estimate, not an optimiser.
 */
export function VoyagePlanner({ transits }: { transits: TransitMap }) {
  const [fromId, setFromId] = useState('rotterdam')
  const [toId, setToId] = useState('singapore')
  const [speed, setSpeed] = useState(14)

  const plan = useMemo(() => {
    const from = PLAN_PORTS.find((p) => p.id === fromId) ?? PLAN_PORTS[0]
    const to = PLAN_PORTS.find((p) => p.id === toId) ?? PLAN_PORTS[1]

    // Use a published trade lane when one connects these ports, so the route is
    // navigable instead of a great circle that crosses land.
    const lane = matchTradeLane(fromId, toId)
    const via = lane ? lane.via : []
    const waterwayIds = lane
      ? lane.waterways
      : chokepoints
          .map((cp) => ({
            id: cp.id,
            d: crossTrackNm(from.coord, to.coord, cp.center),
          }))
          .filter((entry) => entry.d.deviationNm < 250 && entry.d.progress > 0.05 && entry.d.progress < 0.95)
          .sort((x, y) => x.d.progress - y.d.progress)
          .map((entry) => entry.id)

    const onRoute = waterwayIds
      .map((id) => chokepoints.find((cp) => cp.id === id))
      .filter((cp): cp is (typeof chokepoints)[number] => Boolean(cp))
      .map((cp) => ({
        id: cp.id,
        name: cp.name,
        coord: cp.center,
        dailyTransits: transits[cp.id] ? transits[cp.id]!.total / 365 : 0,
        transitHours: cp.summary.transitHours,
        capacityPerDay:
          cp.channel.lockChambers > 0
            ? cp.channel.lockChambers * 12
            : Math.round(24 / Math.max(cp.summary.transitHours / 6, 0.5)),
      }))

    // The lane's `via` points already trace the navigable route and include the
    // waterway landfalls, so appending the gate centres again doubled the
    // distance (20,022 NM instead of ~7,900 NM).
    const waypoints = [
      { name: from.name, coord: from.coord as [number, number] },
      ...via.map((v) => ({ name: v.name, coord: v.coord })),
      ...(lane ? [] : onRoute.map((cp) => ({ name: cp.name, coord: cp.coord as [number, number] }))),
      { name: to.name, coord: to.coord as [number, number] },
    ]

    const computed = planVoyage({
      waypoints,
      serviceSpeedKn: speed,
      transitSpeedKn: Math.min(speed, 8),
      waterways: onRoute.map((cp) => ({
        id: cp.id,
        name: cp.name,
        dailyTransits: cp.dailyTransits,
        transitHours: cp.transitHours,
        capacityPerDay: cp.capacityPerDay,
      })),
    })

    return {
      from,
      to,
      onRoute,
      lane,
      plan: computed,
      referenceNm: lane?.referenceNm ?? null,
    }
  }, [fromId, toId, speed, transits])

  const { plan: p, onRoute, from, to, lane, referenceNm } = plan
  const etaDate = new Date(p.eta)

  return (
    <section className="rail-panel voyage-panel">
      <div className="rail-panel-head">
        <div>
          <span className="eyebrow">VOYAGE PLANNER / 航线规划</span>
          <h3>ROUTE &amp; ETA</h3>
        </div>
        <span className="panel-code">CALC</span>
      </div>

      <div className="voyage-picker">
        <label>
          <span>FROM</span>
          <select value={fromId} onChange={(e) => setFromId(e.target.value)}>
            {PLAN_PORTS.map((port) => (
              <option key={port.id} value={port.id}>
                {port.name}
              </option>
            ))}
          </select>
        </label>
        <span className="voyage-arrow">→</span>
        <label>
          <span>TO</span>
          <select value={toId} onChange={(e) => setToId(e.target.value)}>
            {PLAN_PORTS.map((port) => (
              <option key={port.id} value={port.id}>
                {port.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="voyage-speed">
        <span>服务航速</span>
        <input
          type="range"
          min={8}
          max={22}
          step={0.5}
          value={speed}
          aria-label="Service speed"
          onChange={(e) => setSpeed(Number(e.target.value))}
        />
        <strong>{speed.toFixed(1)} kn</strong>
      </div>

      {lane && (
        <div className="voyage-lane">
          <span>TRADE LANE</span>
          <strong>{lane.name}</strong>
          <em>{lane.nameZh} · 参考里程 {referenceNm?.toLocaleString('en-US')} NM</em>
        </div>
      )}

      <div className="voyage-stats">
        <div>
          <RouteIcon size={11} />
          <span>GREAT CIRCLE</span>
          <strong>{p.totalNm.toLocaleString('en-US')}<small>NM</small></strong>
        </div>
        <div>
          <Clock size={11} />
          <span>SEA TIME</span>
          <strong>{formatDuration(p.steamingHours)}</strong>
        </div>
        <div>
          <Anchor size={11} />
          <span>WATERWAY</span>
          <strong>{formatDuration(p.waterwayHours)}</strong>
        </div>
      </div>

      <div className="voyage-eta">
        <span>ETA · {from.name} → {to.name}</span>
        <strong>
          {etaDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}{' '}
          {etaDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}Z
        </strong>
        <em>总计 {formatDuration(p.totalHours)}</em>
      </div>

      {onRoute.length > 0 && (
        <div className="voyage-waterways">
          <span className="voyage-waterways__head">途经水道 · {onRoute.length}</span>
          {onRoute.map((cp) => (
            <div className="voyage-waterway" key={cp.id}>
              <span>{cp.name}</span>
              <em>{cp.dailyTransits > 0 ? `${cp.dailyTransits.toFixed(1)}/d` : '—'}</em>
            </div>
          ))}
        </div>
      )}

      <details className="voyage-assumptions">
        <summary>计算假设 · {p.assumptions.length} 项</summary>
        <ul>
          {p.assumptions.map((line) => (
            <li key={line}>{line}</li>
          ))}
          <li>
            距离为大圆直线求和，<b>不绕避陆地</b>，因此是实际航线里程的下限。
            例：鹿特丹→新加坡大圆约 5,700NM，经苏伊士的实际航线约 8,300NM。
          </li>
          <li>未计入港口内锚泊、装卸与运河编队等待以外的延迟</li>
        </ul>
      </details>
    </section>
  )
}
