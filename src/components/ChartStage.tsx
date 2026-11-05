import { useRef, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import {
  Anchor,
  Crosshair,
  Globe2,
  History,
  LocateFixed,
  Minus,
  Plus,
  Route,
  Waves,
} from 'lucide-react'
import type { Chokepoint, ChokepointId, MapMode, Vessel, WeatherSnapshot } from '../types'
import { chokepoints, modeMeta } from '../data/chokepoints'
import { everGiven } from '../data/blockade'
import { getReconState } from '../lib/blockade'
import { formatCoordinate, formatMoney } from '../lib/geo'
import { lazy, Suspense } from 'react'
import type { MapCanvasHandle } from './MapCanvas'

// MapLibre is the single largest dependency; defer it so the shell paints first.
const MapCanvas = lazy(() =>
  import('./MapCanvas').then((mod) => ({ default: mod.MapCanvas })),
)
import { VesselDetail } from './VesselDetail'
import { OceanPanel } from './OceanPanel'
import { ChartGraticule } from './ChartGraticule'
import { hasTss } from '../lib/tss'
import { useChartProbe } from '../lib/useChartProbe'
import type { LiveAisState } from '../lib/useLiveAis'
import type { OceanObservationState } from '../lib/useOceanObservations'
import type { OceanLayerId } from '../data/oceanLayers'
import { ToneDot, WeatherArrow } from './Primitives'

const modeIcons = {
  flow: Route,
  bathymetry: Waves,
  anchorages: Anchor,
  recon: History,
  world: Globe2,
} as const

function CompassRose() {
  return (
    <div className="compass-rose">
      <svg viewBox="0 0 92 92" aria-hidden="true">
        <circle className="compass-ring" cx="46" cy="46" r="38" />
        <circle className="compass-ring compass-ring--inner" cx="46" cy="46" r="31" />
        {Array.from({ length: 36 }).map((_, index) => (
          <line
            key={index}
            className={index % 9 === 0 ? 'compass-tick is-major' : 'compass-tick'}
            x1="46"
            y1={index % 9 === 0 ? 4 : 6}
            x2="46"
            y2={index % 9 === 0 ? 12 : 9}
            transform={`rotate(${index * 10} 46 46)`}
          />
        ))}
        <path className="compass-north" d="M46 17 51.5 47 46 43 40.5 47Z" />
        <path className="compass-south" d="M46 75 40.5 47 46 50 51.5 47Z" />
        <text x="46" y="28" textAnchor="middle" className="compass-letter">
          N
        </text>
        <circle cx="46" cy="46" r="2" className="compass-pivot" />
      </svg>
    </div>
  )
}

function ModeLegend({
  mode,
  chokepoint,
}: {
  mode: MapMode
  chokepoint: Chokepoint
}) {
  if (mode === 'bathymetry') {
    const ticks = [0, ...chokepoint.depth.contours]
    return (
      <>
        <span className="legend-title">DEPTH / 水深</span>
        <div className="depth-gradient" />
        <div className="depth-labels">
          {ticks.map((depth) => (
            <span key={depth}>{depth}M</span>
          ))}
        </div>
        <span className="legend-note">
          {chokepoint.bathySource === 'emodnet'
            ? 'EMODnet multicolour · GEBCO 2026'
            : 'GEBCO 2026 global grid'}
        </span>
      </>
    )
  }

  if (mode === 'anchorages') {
    return (
      <>
        <span className="legend-title">WAIT INTENSITY / 等待强度</span>
        <div className="wait-gradient" />
        <div className="depth-labels">
          <span>0H</span>
          <span>12H</span>
          <span>24H</span>
          <span>48H+</span>
        </div>
        <span className="legend-note">AIS dwell time × anchorage density</span>
      </>
    )
  }

  if (mode === 'recon') {
    return (
      <>
        <span className="legend-title">BLOCKADE RECON / 封锁推演</span>
        <div className="recon-legend-row">
          <span><i className="legend-box legend-box--closed" /> CLOSED</span>
          <span><i className="legend-box legend-box--queue" /> QUEUE</span>
          <span><i className="legend-box legend-box--ship" /> EVER GIVEN</span>
        </div>
        <span className="legend-note">AIS reconstruction · archive 23–29 MAR 2021</span>
      </>
    )
  }

  return (
    <>
      <span className="legend-title">TRAFFIC / 船舶</span>
      <div className="vessel-legend">
        {(['container', 'bulk', 'lng', 'vlcc'] as const).map((type) => (
          <span key={type}>
            <i className={`legend-dot legend-dot--${type}`} />
            {type === 'container' ? 'CONT' : type === 'bulk' ? 'BULK' : type.toUpperCase()}
          </span>
        ))}
      </div>
      <div className="legend-divider" />
      <div className="legend-other">
        <span><i className="legend-line legend-line--route" /> CONVOY LANE</span>
        <span><i className="legend-ring" /> ANCHORAGE</span>
        {hasTss(chokepoint.id) && (
          <>
            <span><i className="legend-box legend-box--inbound" /> INBOUND</span>
            <span><i className="legend-box legend-box--outbound" /> OUTBOUND</span>
          </>
        )}
      </div>
    </>
  )
}

export function ChartStage({
  chokepoint,
  mode,
  onModeChange,
  onSelectChokepoint,
  vessels,
  selectedVessel,
  onSelectVessel,
  onCycleVessel,
  timeScale,
  onTimeScale,
  activeOceanLayers,
  onToggleOceanLayer,
  oceanObservations,
  trackFrame,
  liveAis,
  liveAisOn,
  onToggleLiveAis,
  weather,
  reconProgress,
  onOpenSources,
}: {
  chokepoint: Chokepoint
  mode: MapMode
  onModeChange: (mode: MapMode) => void
  onSelectChokepoint: (id: ChokepointId) => void
  vessels: Vessel[]
  selectedVessel: Vessel
  onSelectVessel: (id: string) => void
  onCycleVessel: (direction: -1 | 1) => void
  timeScale: number
  onTimeScale: (value: number) => void
  activeOceanLayers: OceanLayerId[]
  onToggleOceanLayer: (id: OceanLayerId) => void
  oceanObservations: OceanObservationState
  trackFrame: { mmsi: string; lon: number; lat: number }[] | null
  liveAis: LiveAisState
  liveAisOn: boolean
  onToggleLiveAis: () => void
  weather: WeatherSnapshot & { weatherLabel: string }
  reconProgress: number
  onOpenSources: () => void
}) {
  const mapRef = useRef<MapCanvasHandle>(null)
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null)
  const { graticule, scale } = useChartProbe(mapInstance)
  const recon = getReconState(reconProgress)
  const modeLabel = modeMeta.find((entry) => entry.id === mode)
  const activeStatus =
    mode === 'recon'
      ? `${recon.phase} · ${recon.queue} HELD`
      : chokepoint.status === 'FLOWING'
        ? 'NOMINAL FLOW'
        : chokepoint.status

  return (
    <section className="stage">
      <div className="stage-topbar">
        <div className="stage-ident">
          <span className="stage-number">{chokepoint.index}</span>
          <div>
            <div className="stage-name">
              <h2>{chokepoint.name}</h2>
              <span>{chokepoint.nameZh}</span>
            </div>
            <div className="stage-meta">
              <span>CHART CP–{chokepoint.index} / ENC 3857</span>
              <i />
              <span>{chokepoint.region}</span>
              <i />
              <span>{chokepoint.channel.lengthKm.toFixed(1)} KM</span>
              <i />
              <span className={`stage-status stage-status--${chokepoint.tone}`}>
                <ToneDot tone={chokepoint.tone} />
                {activeStatus}
              </span>
            </div>
          </div>
        </div>

        <div className="stage-mode-tabs" role="tablist" aria-label="Chart layer">
          {modeMeta.map((entry) => {
            const Icon = modeIcons[entry.id]
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={mode === entry.id}
                className={`mode-tab ${mode === entry.id ? 'is-active' : ''}`}
                onClick={() => onModeChange(entry.id)}
              >
                <Icon size={13} strokeWidth={1.6} />
                <span>{entry.code}</span>
                <small>{entry.labelZh}</small>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mobile-choke-tabs">
        {chokepoints.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={entry.id === chokepoint.id ? 'is-active' : ''}
            onClick={() => onSelectChokepoint(entry.id)}
          >
            <span>{entry.index}</span>
            {entry.name}
          </button>
        ))}
      </div>

      <div className={`map-frame map-frame--${mode}`}>
        <Suspense
          fallback={
            <div className="chart-loader" aria-hidden="true">
              <span className="chart-loader__ring" />
              <span className="chart-loader__label">LOADING CHART ENGINE</span>
              <em>海图引擎载入中</em>
            </div>
          }
        >
        <MapCanvas
          ref={mapRef}
          chokepoint={chokepoint}
          vessels={vessels}
          liveVessels={liveAis.vessels}
          selectedId={selectedVessel.id}
          mode={mode}
          onSelectVessel={onSelectVessel}
          onSelectChokepoint={onSelectChokepoint}
          reconProgress={reconProgress}
          timeScale={timeScale}
          activeOceanLayers={activeOceanLayers}
          buoys={oceanObservations.buoys}
          quakes={oceanObservations.quakes}
          trackFrame={trackFrame}
          onMapReady={setMapInstance}
        />
        </Suspense>

        <div className="map-grid-overlay" aria-hidden="true" />
        <div className="map-corner-bracket map-corner-bracket--tl" aria-hidden="true" />
        <div className="map-corner-bracket map-corner-bracket--tr" aria-hidden="true" />
        <div className="map-corner-bracket map-corner-bracket--bl" aria-hidden="true" />
        <div className="map-corner-bracket map-corner-bracket--br" aria-hidden="true" />

        <div className="map-hud map-hud--topleft">
          <span className="hud-kicker">PRIMARY CHART / 主图</span>
          <strong>{formatCoordinate(chokepoint.center)}</strong>
          <div className="hud-line">
            <span>{modeLabel?.label.toUpperCase()}</span>
            <i />
            <span>{chokepoint.channel.lengthKm.toFixed(0)} KM</span>
            <i />
            <span>WGS 84</span>
          </div>
        </div>

        <div className="map-hud map-hud--weather">
          <div className="weather-head">
            <span className="hud-kicker">MET / 气象</span>
            <span className={`wx-status ${weather.status}`}>
              <i /> {weather.status === 'live' ? 'LIVE' : 'MODEL'}
            </span>
          </div>
          <div className="weather-main">
            <span className="weather-wind-icon">
              <WeatherArrow direction={weather.windDir} />
            </span>
            <div>
              <strong>{weather.windKnots.toFixed(0)}<small> KT</small></strong>
              <span>{weather.weatherLabel}</span>
            </div>
          </div>
          <div className="weather-readouts">
            <span>
              <em>SEA</em>
              {weather.waveM !== null ? `${weather.waveM.toFixed(1)} M` : 'N/A'}
            </span>
            <span>
              <em>VIS</em>
              {weather.visibilityKm.toFixed(1)} KM
            </span>
            <span>
              <em>AIR</em>
              {weather.airTempC.toFixed(1)}°C
            </span>
          </div>
        </div>

        {mode !== 'recon' && mode !== 'world' && (
          <div className="time-scale-control">
            <span className="time-scale-label">TIME</span>
            {[
              { value: 1, label: '1×', title: '真实速度：8 节的船 1 分钟移动约 1 像素' },
              { value: 60, label: '60×', title: '1 分钟 = 1 小时，全程约 11 分钟' },
              { value: 600, label: '600×', title: '6 秒 = 1 小时，全程约 65 秒' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                className={timeScale === option.value ? 'is-active' : ''}
                onClick={() => onTimeScale(option.value)}
                title={option.title}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        <OceanPanel
          active={activeOceanLayers}
          onToggle={onToggleOceanLayer}
          observations={oceanObservations}
        />

        <div className={`live-ais-pill ${liveAisOn ? 'is-on' : ''}`}>
          <button type="button" className="live-ais-toggle" onClick={onToggleLiveAis}>
            <span className={`live-ais-dot live-ais-dot--${liveAis.status}`} />
            <span className="live-ais-label">
              LIVE AIS
              {liveAisOn && liveAis.status === 'live' && (
                <em>{liveAis.count} HULLS · BALTIC</em>
              )}
              {liveAisOn && liveAis.status === 'loading' && <em>CONNECTING…</em>}
              {liveAisOn && liveAis.status === 'error' && <em>FEED UNAVAILABLE</em>}
              {!liveAisOn && <em>OFF</em>}
            </span>
          </button>
          {liveAisOn && liveAis.status === 'live' && (
            <button
              type="button"
              className="live-ais-refresh"
              onClick={liveAis.refresh}
              aria-label="刷新实时 AIS"
            >
              ↻
            </button>
          )}
        </div>

        <div className="map-tools">
          <CompassRose />
          <div className="map-tool-stack">
            <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in">
              <Plus size={15} />
            </button>
            <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out">
              <Minus size={15} />
            </button>
            <button
              type="button"
              className="recenter-button"
              onClick={() => mapRef.current?.recenter()}
              aria-label="Recenter chart"
            >
              <LocateFixed size={14} />
            </button>
          </div>
        </div>

        {mode === 'recon' && (
          <div className={`recon-HUD recon-HUD--${recon.phase.toLowerCase()}`}>
            <div className="recon-HUD__head">
              <span><i /> HISTORICAL RECONSTRUCTION</span>
              <em>{everGiven.durationLabel}</em>
            </div>
            <div className="recon-HUD__main">
              <div>
                <span>CANAL STATE</span>
                <strong>{recon.phase}</strong>
              </div>
              <div>
                <span>VESSELS HELD</span>
                <strong>{recon.queue}<small> / 369</small></strong>
              </div>
              <div>
                <span>TRADE AT RISK</span>
                <strong>{formatMoney(recon.cost)}</strong>
              </div>
            </div>
            <div className="recon-HUD__event">
              <span>{recon.event.date} · {recon.event.time}</span>
              <strong>{recon.event.title}</strong>
              <p>{recon.event.detail}</p>
            </div>
          </div>
        )}

        <div className="map-legend map-legend--bottomleft">
          <ModeLegend mode={mode} chokepoint={chokepoint} />
        </div>

        {mode !== 'recon' && mode !== 'world' && (
          <VesselDetail
            chokepoint={chokepoint}
            vessel={selectedVessel}
            onCycle={onCycleVessel}
          />
        )}

        <ChartGraticule graticule={graticule} scale={scale} />

        <div className="map-footer-line">
          <span className="map-footer-sync">
            <i />
            FEED SYNC {weather.status === 'live' ? weather.time : '06:42'}:{weather.status === 'live' ? '00' : '18'}Z
          </span>
          <button type="button" onClick={onOpenSources}>
            © OPENSTREETMAP / OPENFREEMAP · EMODNET / GEBCO · OPEN-METEO
          </button>
          <button type="button" className="map-credit-short" onClick={onOpenSources}>
            © OSM · EMODNET
          </button>
          <span className="map-footer-coord">
            <Crosshair size={11} />
            {mode === 'recon'
              ? `EVER GIVEN · ${everGiven.draft.toFixed(1)}M · AGROUND`
              : `${selectedVessel.name} · ${selectedVessel.draft.toFixed(1)}M`}
          </span>
        </div>

        <div className="map-data-strip">
          <div>
            <span>QUEUE</span>
            <strong>{mode === 'recon' ? recon.queue : chokepoint.summary.queue}</strong>
          </div>
          <div>
            <span>AVG WAIT</span>
            {mode === 'recon' ? (
              <strong>—</strong>
            ) : (
              <strong>{chokepoint.summary.avgWaitHours.toFixed(1)}<small>H</small></strong>
            )}
          </div>
          <div>
            <span>CONTROL DEPTH</span>
            <strong>{chokepoint.depth.chartDepth.toFixed(1)}<small>M</small></strong>
          </div>
          <div>
            <span>{mode === 'recon' ? 'TRANSIT / D' : 'TRAFFIC'}</span>
            <strong>{mode === 'recon' ? recon.throughput : chokepoint.summary.active}</strong>
          </div>
          <div className="map-data-strip__signal">
            <span>LINK</span>
            <strong className="signal-bars"><i /><i /><i /><i /></strong>
          </div>
        </div>
      </div>
    </section>
  )
}
