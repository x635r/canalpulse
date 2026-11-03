import type { GraticuleState, ScaleState } from '../lib/useChartProbe'

/** Chart graticule + live scale bar overlay. */
export function ChartGraticule({
  graticule,
  scale,
}: {
  graticule: GraticuleState
  scale: ScaleState
}) {
  const latLabel = `${Math.abs(graticule.centerLat).toFixed(3)}°${graticule.centerLat >= 0 ? 'N' : 'S'}`
  const lngLabel = `${Math.abs(graticule.centerLng).toFixed(3)}°${graticule.centerLng >= 0 ? 'E' : 'W'}`

  return (
    <>
      <div className="chart-graticule" aria-hidden="true">
        <span className="chart-graticule__lat">{latLabel}</span>
        <span className="chart-graticule__lng">{lngLabel}</span>
        <span className="chart-graticule__zoom">Z {graticule.zoom.toFixed(2)}</span>
      </div>
      <div className="map-scale">
        <span className="scale-bar" style={{ width: `${Math.max(28, scale.pixels)}px` }}>
          <i />
          <i />
          <i />
          <i />
        </span>
        <div style={{ width: `${Math.max(28, scale.pixels)}px` }}>
          <span>0</span>
          <span>{scale.label}</span>
        </div>
        <em>WEB MERCATOR / WGS 84</em>
      </div>
    </>
  )
}
