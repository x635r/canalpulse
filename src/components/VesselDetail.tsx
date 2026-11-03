import { useState } from 'react'
import { Anchor, ArrowDownRight, ArrowUpRight, ChevronDown, ChevronUp, Compass, Navigation, Ship } from 'lucide-react'
import type { Chokepoint, Vessel } from '../types'
import { vesselTypes } from '../data/fleet'
import { formatCoordinate, haversineKm, pointAlong } from '../lib/geo'

function livePosition(chokepoint: Chokepoint, vessel: Vessel): [number, number] {
  if (vessel.status === 'anchored' && vessel.position) return vessel.position
  return pointAlong(chokepoint.route, vessel.progress)
}

function statusLabel(vessel: Vessel) {
  if (vessel.status === 'anchored') return 'AT ANCHOR'
  if (vessel.status === 'transit') return 'IN TRANSIT'
  return 'UNDERWAY'
}

function courseLabel(heading: number) {
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return points[Math.round(heading / 22.5) % 16]
}

export function VesselDetail({
  chokepoint,
  vessel,
  onCycle,
}: {
  chokepoint: Chokepoint
  vessel: Vessel
  onCycle: (direction: -1 | 1) => void
}) {
  const meta = vesselTypes[vessel.type]
  const position = livePosition(chokepoint, vessel)
  const anchorage = chokepoint.anchorages.find((entry) => entry.id === vessel.anchorageId)
  const nextWaypoint = chokepoint.waypoints[vessel.direction === 'in' ? 0 : chokepoint.waypoints.length - 1]
  const distanceToWaypoint = haversineKm(position, nextWaypoint.coord)
  const heading = vessel.heading
  // Collapsed by default so the panel never covers the waterway being watched.
  const [expanded, setExpanded] = useState(false)

  return (
    <section
      className={`vessel-detail ${expanded ? 'is-expanded' : 'is-collapsed'}`}
      aria-label="选中船舶详情"
    >
      <header className="vessel-detail__head">
        <span className={`vessel-detail__type vessel-detail__type--${vessel.type}`}>
          <Ship size={13} strokeWidth={1.6} />
          {meta.code}
        </span>
        <div className="vessel-detail__id">
          <strong>{vessel.name}</strong>
          <em>
            {meta.label} <i>·</i> IMO {vessel.imo}
          </em>
        </div>
        <button
          type="button"
          className="vessel-detail__toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-label={expanded ? '收起船舶详情' : '展开船舶详情'}
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        <div className="vessel-detail__cycle">
          <button type="button" onClick={() => onCycle(-1)} aria-label="上一艘">
            ‹
          </button>
          <button type="button" onClick={() => onCycle(1)} aria-label="下一艘">
            ›
          </button>
        </div>
      </header>

      <div className="vessel-detail__status">
        <span className={`vessel-detail__state vessel-detail__state--${vessel.status}`}>
          {vessel.status === 'anchored' ? <Anchor size={11} /> : <Navigation size={11} />}
          {statusLabel(vessel)}
        </span>
        <span className="vessel-detail__flag">FLAG {vessel.flag}</span>
        <span className="vessel-detail__flag">{vessel.draft.toFixed(1)}M DRAFT</span>
        <span className="vessel-detail__coord">{formatCoordinate(position, 3)}</span>
      </div>

      <div className="vessel-detail__body">
        <dl className="vessel-detail__grid">
          <div>
            <dt>SOG</dt>
            <dd>{vessel.speed > 0 ? vessel.speed.toFixed(1) : '0.0'}<small>KN</small></dd>
          </div>
          <div>
            <dt>COURSE</dt>
            <dd>{heading.toFixed(0)}<small>° {courseLabel(heading)}</small></dd>
          </div>
          <div>
            <dt>DRAFT</dt>
            <dd>{vessel.draft.toFixed(1)}<small>M</small></dd>
          </div>
          <div>
            <dt>LOA / BEAM</dt>
            <dd>{vessel.loa.toFixed(0)}<small>M / {vessel.beam.toFixed(0)}M</small></dd>
          </div>
          <div>
            <dt>MMSI</dt>
            <dd className="is-text">{vessel.mmsi}</dd>
          </div>
          <div>
            <dt>DWT</dt>
            <dd className="is-text">{vessel.dwt}</dd>
          </div>
          <div>
            <dt>{vessel.status === 'anchored' ? 'WAITED' : 'ETA'}</dt>
            <dd className="is-text">
              {vessel.status === 'anchored' ? `${vessel.waitHours.toFixed(1)}H` : vessel.eta}
            </dd>
          </div>
          <div>
            <dt>POSITION</dt>
            <dd className="is-text">{vessel.status === 'anchored' ? 'HOLDING' : 'MOVING'}</dd>
          </div>
        </dl>

        <div className="vessel-detail__route">
          <div>
            <span className="vessel-detail__route-label">
              <ArrowUpRight size={10} /> FROM
            </span>
            <strong>{vessel.origin}</strong>
          </div>
          <span className="vessel-detail__route-line" />
          <div>
            <span className="vessel-detail__route-label">
              <ArrowDownRight size={10} /> TO
            </span>
            <strong>{vessel.destination}</strong>
          </div>
        </div>

        <footer className="vessel-detail__foot">
          <span>
            <Compass size={10} />
            {anchorage ? anchorage.name : `${nextWaypoint.name} · ${distanceToWaypoint.toFixed(1)} NM`}
          </span>
          <span className="vessel-detail__hint">DEMO FLEET</span>
        </footer>
      </div>
    </section>
  )
}
