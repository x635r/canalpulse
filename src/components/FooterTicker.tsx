import { chokepoints } from '../data/chokepoints'

const extraBulletins = [
  'MARKET · Suez max authorized draft 20.10m · SCA circular 04/2026',
  'ARCHIVE · Ever Given / IMO 9811000 · grounded 23 MAR 2021 · 07:40 EGY',
  'QUERY · AIS replay is deterministic; WMS and weather layers are live public feeds',
]

export function FooterTicker() {
  const bulletins = [...chokepoints.map((entry) => `${entry.name} · ${entry.bulletin}`), ...extraBulletins]

  return (
    <footer className="ticker">
      <div className="ticker-label">
        <i />
        <span>WIRE / 动态</span>
      </div>
      <div className="ticker-track-wrap">
        <div className="ticker-track">
          {[...bulletins, ...bulletins].map((bulletin, index) => (
            <span key={`${bulletin}-${index}`}>
              <em>{String((index % bulletins.length) + 1).padStart(2, '0')}</em>
              {bulletin}
            </span>
          ))}
        </div>
      </div>
      <div className="ticker-meta">
        <span className="ticker-warning">NOT FOR NAVIGATION</span>
        <span>AIS REPLAY</span>
        <span>BATHY WMS</span>
        <span className="ticker-utc">UTC</span>
      </div>
    </footer>
  )
}
