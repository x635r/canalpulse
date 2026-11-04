import { useState } from 'react'
import { ChevronDown, Layers, Waves } from 'lucide-react'
import { oceanLayers, type OceanLayerId } from '../data/oceanLayers'
import type { OceanObservationState } from '../lib/useOceanObservations'

const groupLabels: Record<string, { en: string; zh: string }> = {
  thermal: { en: 'THERMAL', zh: '热力' },
  bio: { en: 'BIO-OPTICAL', zh: '生物光学' },
  observation: { en: 'OBSERVATION', zh: '实测' },
  hazard: { en: 'HAZARD', zh: '灾害' },
}

function LayerSwatch({ id, active }: { id: OceanLayerId; active: boolean }) {
  const def = oceanLayers.find((entry) => entry.id === id)
  const stops = def?.legend?.stops ?? ['#4fa3b8', '#7fd6c9']
  return (
    <span
      className={`ocean-swatch ${active ? 'is-on' : ''}`}
      style={{
        background: `linear-gradient(90deg, ${stops.join(', ')})`,
      }}
    />
  )
}

export function OceanPanel({
  active,
  onToggle,
  observations,
}: {
  active: OceanLayerId[]
  onToggle: (id: OceanLayerId) => void
  observations: OceanObservationState
}) {
  const [expanded, setExpanded] = useState(true)
  const activeSet = new Set(active)

  const groups = ['thermal', 'bio', 'observation', 'hazard'] as const
  // Show the gradient for the most recently relevant active raster layer.
  const legendLayer = oceanLayers.find(
    (layer) => activeSet.has(layer.id) && layer.legend !== undefined,
  )

  return (
    <section className={`ocean-panel ${expanded ? 'is-expanded' : ''}`}>
      <header className="ocean-panel__head">
        <button
          type="button"
          className="ocean-panel__toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          <Layers size={12} strokeWidth={1.7} />
          <span>OCEAN DATA</span>
          <em>海洋数据 · {active.length}</em>
          <ChevronDown size={12} className={expanded ? 'is-open' : ''} />
        </button>
      </header>

      <div className="ocean-panel__body">
        <div className="ocean-panel__status">
          <span className={`ocean-status ocean-status--${observations.status}`}>
            <i />
            {observations.status === 'live'
              ? 'LIVE'
              : observations.status === 'partial'
                ? 'PARTIAL'
                : observations.status === 'loading'
                  ? 'SYNC'
                  : observations.status === 'error'
                    ? 'OFFLINE'
                    : 'IDLE'}
          </span>
          <span className="ocean-panel__counts">
            <Waves size={10} />
            {observations.buoys.length} BUOYS · {observations.quakes.length} QUAKES
          </span>
        </div>

        {groups.map((group) => {
          const items = oceanLayers.filter((layer) => layer.group === group)
          if (items.length === 0) return null
          return (
            <div className="ocean-group" key={group}>
              <div className="ocean-group__label">
                <span>{groupLabels[group].en}</span>
                <em>{groupLabels[group].zh}</em>
              </div>
              {items.map((layer) => {
                const isOn = activeSet.has(layer.id)
                return (
                  <button
                    key={layer.id}
                    type="button"
                    className={`ocean-layer ${isOn ? 'is-on' : ''}`}
                    onClick={() => onToggle(layer.id)}
                    aria-pressed={isOn}
                    title={layer.note}
                  >
                    <LayerSwatch id={layer.id} active={isOn} />
                    <span className="ocean-layer__label">
                      <strong>{layer.label}</strong>
                      <em>{layer.labelZh}</em>
                    </span>
                    {layer.legend && (
                      <span className="ocean-layer__range">
                        {layer.legend.min}–{layer.legend.max}
                        {layer.legend.unit}
                      </span>
                    )}
                    <span className={`ocean-layer__dot ${isOn ? 'is-on' : ''}`} />
                  </button>
                )
              })}
            </div>
          )
        })}

        {legendLayer && legendLayer.legend && (
          <div className="ocean-legend">
            <div className="ocean-legend__head">
              <span>{legendLayer.labelZh}</span>
              <em>
                {legendLayer.legend.min}–{legendLayer.legend.max}
                {legendLayer.legend.unit}
              </em>
            </div>
            <div
              className="ocean-legend__bar"
              style={{ background: `linear-gradient(90deg, ${legendLayer.legend.stops.join(', ')})` }}
            />
            <div className="ocean-legend__scale">
              <span>{legendLayer.legend.min}</span>
              <span>{legendLayer.legend.max}</span>
            </div>
          </div>
        )}

        <footer className="ocean-panel__foot">
          <span>NASA GIBS · NOAA NDBC · USGS</span>
        </footer>
      </div>
    </section>
  )
}
