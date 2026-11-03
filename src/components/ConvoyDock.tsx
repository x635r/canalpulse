import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Gauge,
  Pause,
  Play,
  Plus,
  RotateCcw,
} from 'lucide-react'
import type { Chokepoint, VesselTypeId } from '../types'
import { vesselTypes } from '../data/fleet'
import { ShipGlyph } from './Primitives'

type Lane = 'primary' | 'secondary'

type SimShip = {
  id: number
  type: VesselTypeId
  progress: number
  lane: Lane
  jitter: number
}

const typeCycle: VesselTypeId[] = ['container', 'bulk', 'lng', 'vlcc']

function makeShips(): SimShip[] {
  const ships: SimShip[] = []
  let id = 1
  for (let index = 0; index < 9; index += 1) {
    ships.push({
      id: id++,
      type: typeCycle[index % 4],
      progress: (0.04 + index * 0.103 + (index % 3) * 0.012) % 1,
      lane: 'primary',
      jitter: 0.75 + (index % 4) * 0.11,
    })
  }
  for (let index = 0; index < 8; index += 1) {
    ships.push({
      id: id++,
      type: typeCycle[(index + 2) % 4],
      progress: (0.11 + index * 0.113 + (index % 2) * 0.03) % 1,
      lane: 'secondary',
      jitter: 0.68 + (index % 5) * 0.1,
    })
  }
  return ships
}

function formatClock(minutes: number) {
  const safe = Math.max(0, Math.round(minutes))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export function ConvoyDock({ chokepoint }: { chokepoint: Chokepoint }) {
  const [ships, setShips] = useState<SimShip[]>(makeShips)
  const [playing, setPlaying] = useState(true)
  const [rate, setRate] = useState(0.65)
  const [focus, setFocus] = useState<Lane>('primary')
  const [injected, setInjected] = useState(0)
  const playingRef = useRef(playing)
  const rateRef = useRef(rate)

  useEffect(() => {
    playingRef.current = playing
    rateRef.current = rate
  }, [playing, rate])

  useEffect(() => {
    let last = performance.now()
    let raf = 0
    let lastPaint = 0
    const loop = (time: number) => {
      raf = requestAnimationFrame(loop)
      const delta = Math.min(0.08, (time - last) / 1000)
      last = time
      if (!playingRef.current || document.hidden) return
      if (time - lastPaint < 32) return
      lastPaint = time
      setShips((current) =>
        current.map((ship) => ({
          ...ship,
          progress: (ship.progress + delta * 0.0115 * rateRef.current * ship.jitter) % 1,
        })),
      )
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const activeLane =
    focus === 'primary' ? chokepoint.axis.primary : chokepoint.axis.secondary
  const activeLaneZh =
    focus === 'primary' ? chokepoint.axis.primaryZh : chokepoint.axis.secondaryZh

  const gateOpen = useMemo(() => {
    const gates = [0.3, 0.52, 0.76]
    return gates.map((position) =>
      ships.some((ship) => Math.abs(ship.progress - position) < 0.045),
    )
  }, [ships])

  const injectShip = () => {
    const nextId = ships.reduce((max, ship) => Math.max(max, ship.id), 0) + 1
    const ship: SimShip = {
      id: nextId,
      type: typeCycle[injected % typeCycle.length],
      progress: 0.015,
      lane: focus,
      jitter: 0.75 + (injected % 4) * 0.09,
    }
    setShips((current) => [...current, ship])
    setInjected((value) => value + 1)
    setPlaying(true)
  }

  const reset = () => {
    setShips(makeShips())
    setInjected(0)
    setPlaying(true)
  }

  const primaryCount = ships.filter((ship) => ship.lane === 'primary').length
  const secondaryCount = ships.filter((ship) => ship.lane === 'secondary').length
  const transitRate = Math.min(99, 64 + Math.round(rate * 9) + injected)


  return (
    <section className="convoy-dock panel-sheen">
      <header className="dock-header">
        <div className="dock-title">
          <span className="eyebrow">TRANSIT SANDBOX / 编队过闸沙盒</span>
          <h3>CONVOY FORMATION CONTROL</h3>
        </div>
        <div className="dock-readouts">
          <div>
            <span>GATES</span>
            <strong>{chokepoint.channel.lockChambers > 0 ? String(chokepoint.channel.lockChambers).padStart(2, '0') : 'SL'}</strong>
            <em>{chokepoint.channel.lockChambers > 0 ? 'CHAMBERS' : 'SEA LEVEL'}</em>
          </div>
          <div>
            <span>CROSSING ETA</span>
            <strong>{chokepoint.summary.transitHours.toFixed(1)}<small>H</small></strong>
            <em>{chokepoint.channel.widthM.toLocaleString('en-US')} M WIDE</em>
          </div>
          <div>
            <span>RATE</span>
            <strong>{transitRate}<small>%</small></strong>
            <em>SLOT UTILIZATION</em>
          </div>
        </div>
        <div className="dock-actions">
          <button
            type="button"
            className="play-button"
            onClick={() => setPlaying((value) => !value)}
            aria-label={playing ? 'Pause convoy simulation' : 'Play convoy simulation'}
          >
            {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          </button>
          <div className="rate-switch" aria-label="Simulation rate">
            {[
              { label: '1×', value: 0.65 },
              { label: '2×', value: 1 },
              { label: '4×', value: 1.8 },
            ].map((entry) => (
              <button
                key={entry.label}
                type="button"
                className={rate === entry.value ? 'is-active' : ''}
                onClick={() => setRate(entry.value)}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <button type="button" className="dock-utility" onClick={reset} aria-label="Reset simulation">
            <RotateCcw size={14} />
          </button>
          <button type="button" className="inject-button" onClick={injectShip}>
            <Plus size={13} />
            INJECT HULL
          </button>
        </div>
      </header>

      <div className="dock-body">
        <aside className="dock-side">
          <div className="dock-side__label">DIRECTION / 方向</div>
          <div className="direction-switch">
            <button
              type="button"
              className={focus === 'primary' ? 'is-active' : ''}
              onClick={() => setFocus('primary')}
            >
              <ArrowDown size={14} />
              <span>{chokepoint.axis.primary}</span>
              <em>{primaryCount} HULLS</em>
            </button>
            <button
              type="button"
              className={focus === 'secondary' ? 'is-active' : ''}
              onClick={() => setFocus('secondary')}
            >
              <ArrowUp size={14} />
              <span>{chokepoint.axis.secondary}</span>
              <em>{secondaryCount} HULLS</em>
            </button>
          </div>
          <div className="dock-side__readout">
            <span>ACTIVE CONVOY</span>
            <strong>{activeLane}</strong>
            <em>{activeLaneZh} · {ships.length} HULLS IN VIEW</em>
          </div>
          <div className="dock-side__tide">
            <span><Gauge size={12} /> TIDE / 潮位</span>
            <strong>+{chokepoint.depth.tidalAllowance.toFixed(2)} M</strong>
          </div>
        </aside>

        <div className="lane-view">
          <div className="lane-axis">
            <span>APPROACH</span>
            <span>{chokepoint.channel.lockChambers > 0 ? 'LOCK FLIGHT' : 'PASSING LOOP'}</span>
            <span>RELEASE</span>
          </div>
          <div className="lane-wrap">
            <div className={`convoy-lane convoy-lane--primary ${focus === 'primary' ? 'is-focused' : ''}`}>
              <div className="lane-label">
                <span className="lane-direction"><ArrowRight size={12} /> {chokepoint.axis.primary}</span>
                <em>{primaryCount} HULLS</em>
              </div>
              <div className="lane-bed">
                <span className="lane-centre" />
                {ships
                  .filter((ship) => ship.lane === 'primary')
                  .map((ship) => (
                    <div
                      key={ship.id}
                      className={`sim-ship sim-ship--${ship.type}`}
                      style={{
                        left: `${ship.progress * 100}%`,
                        '--ship-color': vesselTypes[ship.type].color,
                      } as CSSProperties}
                      title={`${vesselTypes[ship.type].label} · ${vesselTypes[ship.type].capacity}`}
                    >
                      <span className="sim-ship__wake" />
                      <ShipGlyph type={ship.type} />
                    </div>
                  ))}
              </div>
            </div>

            <div className={`convoy-lane convoy-lane--secondary ${focus === 'secondary' ? 'is-focused' : ''}`}>
              <div className="lane-label">
                <span className="lane-direction"><ArrowLeft size={12} /> {chokepoint.axis.secondary}</span>
                <em>{secondaryCount} HULLS</em>
              </div>
              <div className="lane-bed">
                <span className="lane-centre" />
                {ships
                  .filter((ship) => ship.lane === 'secondary')
                  .map((ship) => (
                    <div
                      key={ship.id}
                      className={`sim-ship sim-ship--${ship.type}`}
                      style={{
                        left: `${ship.progress * 100}%`,
                        '--ship-color': vesselTypes[ship.type].color,
                      } as CSSProperties}
                      title={`${vesselTypes[ship.type].label} · ${vesselTypes[ship.type].capacity}`}
                    >
                      <span className="sim-ship__wake" />
                      <ShipGlyph type={ship.type} direction="out" />
                    </div>
                  ))}
              </div>
            </div>

            <div className="gate-array" aria-hidden="true">
              {[0.3, 0.52, 0.76].map((position, index) => (
                <div
                  className={`gate gate--${index} ${gateOpen[index] ? 'is-open' : ''}`}
                  key={position}
                  style={{ left: `${position * 100}%` }}
                >
                  <span className="gate-rail gate-rail--top" />
                  <span className="gate-light" />
                  <span className="gate-rail gate-rail--bottom" />
                  <em>{chokepoint.channel.lockChambers > 0 ? `G${index + 1}` : `P${index + 1}`}</em>
                </div>
              ))}
              <div className="lane-kilometres">
                <span>KM 000</span>
                <span>KM {Math.round(chokepoint.channel.lengthKm / 2)}</span>
                <span>KM {chokepoint.channel.lengthKm.toFixed(0)}</span>
              </div>
            </div>
          </div>
          <div className="lane-footer">
            <span><i className="lane-status-dot" /> {gateOpen.some(Boolean) ? 'GATE SEQUENCE ACTIVE' : 'SEQUENCE HOLDING'}</span>
            <span>SEPARATION 0.4 NM</span>
            <span>SPEED {focus === 'primary' ? '8.2' : '7.8'} KN</span>
            <span>NEXT SLOT {formatClock(38 - injected * 2)}</span>
          </div>
        </div>

        <aside className="dock-telemetry">
          <div className="telemetry-head">
            <span className="eyebrow">SIM TELEMETRY</span>
            <span className="sim-live"><i /> LIVE</span>
          </div>
          <div className="telemetry-big">
            <span>HULLS IN TRANSIT</span>
            <strong>{String(ships.length).padStart(2, '0')}</strong>
            <em>of {chokepoint.summary.queue + chokepoint.summary.active} tracked</em>
          </div>
          <div className="telemetry-bars">
            <div>
              <span>CONTAINER<i style={{ width: '74%' }} /></span>
              <strong>42%</strong>
            </div>
            <div>
              <span>BULK / LNG<i style={{ width: '52%' }} /></span>
              <strong>31%</strong>
            </div>
            <div>
              <span>VLCC<i style={{ width: '31%' }} /></span>
              <strong>19%</strong>
            </div>
          </div>
          <div className="telemetry-note">
            <span><i /> {activeLane}</span>
            <em>{chokepoint.channel.service}</em>
          </div>
        </aside>
      </div>
    </section>
  )
}

