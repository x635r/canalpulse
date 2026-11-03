import { useEffect } from 'react'
import {
  Anchor,
  ArrowUpRight,
  CloudSun,
  Database,
  Map,
  Radar,
  Radio,
  Ship,
  Waves,
  X,
} from 'lucide-react'
import { chokepoints } from '../data/chokepoints'

const sources = [
  {
    name: 'EMODnet Bathymetry',
    scope: 'Bathymetry WMS / global DTM',
    status: 'LIVE',
    tone: 'live',
    icon: Waves,
    href: 'https://emodnet.ec.europa.eu/en/bathymetry',
    note: 'Mean multicolour bathymetry rendered through OGC WMS. Used for the chart tint and depth context.',
  },
  {
    name: 'GEBCO 2026 Grid',
    scope: 'Global ocean depth / undersea features',
    status: 'LIVE',
    tone: 'live',
    icon: Map,
    href: 'https://www.gebco.net/data-products/gebco-web-services',
    note: 'GEBCO WMS alignment service and provenance basis for non-European waters.',
  },
  {
    name: 'Open-Meteo Marine',
    scope: 'Wave height, period, current',
    status: 'LIVE',
    tone: 'live',
    icon: CloudSun,
    href: 'https://open-meteo.com/en/docs/marine-weather-api',
    note: 'Hourly open marine model fields. No browser key required. Fetched for each gate every 15 minutes.',
  },
  {
    name: 'OpenFreeMap / OSM',
    scope: 'Vector basemap / coastlines',
    status: 'LIVE',
    tone: 'live',
    icon: Map,
    href: 'https://openfreemap.org/',
    note: 'OpenStreetMap-derived vector tiles under the custom CanalPulse nautical style.',
  },
  {
    name: 'OpenSeaMap',
    scope: 'Buoys, beacons, TSS boundaries',
    status: 'LIVE',
    tone: 'live',
    icon: Anchor,
    href: 'https://www.openseamap.org/',
    note: 'Raster seamark overlay drawn from z10 up; lower zooms carry area fills rather than point symbols.',
  },
  {
    name: 'Digitraffic AIS',
    scope: 'Live vessel positions + static data',
    status: 'LIVE',
    tone: 'live',
    icon: Radio,
    href: 'https://www.digitraffic.fi/en/meriliikenne/',
    note: 'Fintraffic open AIS, no key required, CORS enabled. Coverage is the Baltic Sea — the only free live feed available to the browser.',
  },
  {
    name: 'AISHub',
    scope: 'Terrestrial AIS positions',
    status: 'ADAPTER',
    tone: 'adapter',
    icon: Radar,
    href: 'https://www.aishub.net/api',
    note: 'Requires a registered user. Kept behind a proxy boundary so keys are never exposed in the browser.',
  },
  {
    name: 'MarineTraffic / VesselFinder',
    scope: 'AIS snapshot + port calls',
    status: 'ADAPTER',
    tone: 'adapter',
    icon: Ship,
    href: 'https://servicedocs.marinetraffic.com/',
    note: 'Commercial JSON snapshot providers. API shape documented in README and normalized by the fleet adapter.',
  },
  {
    name: 'SCA / ACP notices',
    scope: 'Convoy schedules, draft limits, shutdowns',
    status: 'REFERENCE',
    tone: 'reference',
    icon: Database,
    href: 'https://www.suezcanal.gov.eg/English/Pages/default.aspx',
    note: 'Official operational bulletins used for canal constraints, authorization drafts and event timestamps.',
  },
  {
    name: 'IMF PortWatch',
    scope: 'Port disruptions / chokepoint transit index',
    status: 'REFERENCE',
    tone: 'reference',
    icon: Database,
    href: 'https://portwatch.imf.org/',
    note: 'Public daily chokepoint and port activity indicators for historical baselines and anomaly context.',
  },
]

const statusLabels = {
  live: 'PUBLIC LIVE',
  adapter: 'CREDENTIAL ADAPTER',
  reference: 'REFERENCE DATA',
}

export function SourcesDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="drawer-backdrop" role="dialog" aria-modal="true" aria-labelledby="source-drawer-title">
      <button type="button" className="drawer-dismiss" onClick={onClose} aria-label="Close sources panel" />
      <aside className="sources-drawer">
        <header className="drawer-header">
          <div>
            <span className="eyebrow">DATA PROVENANCE / 数据与控制面</span>
            <h2 id="source-drawer-title">SOURCE MATRIX</h2>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </header>

        <div className="drawer-intro">
          <span className="drawer-intro__signal"><i /><i /><i /><i /><i /></span>
          <p>
            CanalPulse is a decision-surface prototype. Public bathymetry, weather and chart data are fetched live;
            AIS traffic is a deterministic scenario replay so the sandbox remains usable without credentials.
          </p>
          <div className="drawer-meta">
            <span><em>NODES</em>{String(chokepoints.length).padStart(2, '0')}</span>
            <span><em>QUEUE SAMPLE</em>{chokepoints.reduce((sum, entry) => sum + entry.summary.queue, 0)} HULLS</span>
            <span><em>ARCHIVE</em>2021 / EVER GIVEN</span>
          </div>
        </div>

        <div className="drawer-section-label">
          <span>01 / FEEDS & PROVENANCE</span>
          <em>8 SOURCES</em>
        </div>

        <div className="source-table">
          {sources.map((source) => {
            const Icon = source.icon
            return (
              <a
                key={source.name}
                className={`source-row source-row--${source.tone}`}
                href={source.href}
                target="_blank"
                rel="noreferrer"
              >
                <span className="source-row__icon"><Icon size={16} strokeWidth={1.5} /></span>
                <span className="source-row__identity">
                  <strong>{source.name}</strong>
                  <em>{source.scope}</em>
                </span>
                <span className="source-row__note">{source.note}</span>
                <span className={`source-row__status source-row__status--${source.tone}`}>
                  <i />
                  {statusLabels[source.tone as keyof typeof statusLabels]}
                </span>
                <ArrowUpRight size={13} className="source-row__link" />
              </a>
            )
          })}
        </div>

        <div className="drawer-section-label">
          <span>02 / MODEL NOTES</span>
          <em>METHOD</em>
        </div>

        <div className="method-grid">
          <article>
            <span className="method-index">A / 01</span>
            <h3>Anchorage dwell</h3>
            <p>
              Queue bins are built from AIS navigation status, speed threshold and anchorage geofences. Heat intensity
              is hull count weighted by dwell time; long-stay hulls project further into the 24H+ band.
            </p>
          </article>
          <article>
            <span className="method-index">A / 02</span>
            <h3>UKC envelope</h3>
            <p>
              UKC = controlling chart depth + tidal allowance − static draft − squat allowance. Warnings use corridor
              minimums; this is a planning model, not a substitute for a passage plan or pilot advice.
            </p>
          </article>
          <article>
            <span className="method-index">A / 03</span>
            <h3>Historical replay</h3>
            <p>
              The Ever Given reconstruction interpolates a published event timeline with a daily backlog series. Map
              queue clusters are synthetic placements inside real anchorage zones, not reconstructed AIS positions.
            </p>
          </article>
          <article>
            <span className="method-index">A / 04</span>
            <h3>Live AIS boundary</h3>
            <p>
              Credentials belong in a server-side proxy. Normalize AISHub XML or VesselFinder JSON into the app&apos;s
              fleet schema, then replace the generated fleet in <code>src/data/fleet.ts</code>.
            </p>
          </article>
        </div>

        <footer className="drawer-footer">
          <span>CANALPULSE / DATA INSTRUMENT</span>
          <span>MapLibre GL · OGC WMS · WGS84 / EPSG:3857</span>
          <span>PUBLIC SOURCES · NOT FOR NAVIGATION</span>
        </footer>
      </aside>
    </div>
  )
}

