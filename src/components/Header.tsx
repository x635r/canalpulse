import { useEffect, useState } from 'react'
import { Database, Radio, Settings2 } from 'lucide-react'
import type { WeatherSnapshot } from '../types'
import { LogoMark, WeatherArrow } from './Primitives'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

function useUtcClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(interval)
  }, [])
  const time = [now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
  return {
    time,
    date: `${DAYS[now.getUTCDay()]} ${String(now.getUTCDate()).padStart(2, '0')} ${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`,
  }
}

export function Header({
  weather,
  pressure,
  onOpenSources,
}: {
  weather: WeatherSnapshot & { weatherLabel: string }
  pressure: number
  onOpenSources: () => void
}) {
  const clock = useUtcClock()

  return (
    <header className="topbar">
      <div className="brand">
        <LogoMark />
        <div className="brand-copy">
          <div className="brand-word">
            CANAL<span>PULSE</span>
            <sup>®</sup>
          </div>
          <div className="brand-sub">GLOBAL CHOKEPOINT COMMAND <i>·</i> 咽喉海峡态势中心</div>
        </div>
      </div>

      <div className="topbar-center">
        <div className="system-tag">
          <span className="system-tag__line" />
          <span>OPS / CP–01</span>
          <span className="system-tag__line" />
        </div>
        <div className="topbar-readouts">
          <div className="topbar-readout">
            <span className="mini-label">NETWORK LOAD</span>
            <strong>
              {pressure.toFixed(1)}
              <small>%</small>
            </strong>
            <span className="mini-bar">
              <i style={{ width: `${pressure}%` }} />
            </span>
          </div>
          <div className="topbar-readout topbar-readout--feed">
            <span className="mini-label">FEEDS</span>
            <strong className="feed-state">
              <span className="live-pip" />
              05 / 05
            </strong>
            <span className="mini-note">PUBLIC + REPLAY</span>
          </div>
          <div className="topbar-readout topbar-readout--weather">
            <span className="mini-label">LOCAL WX</span>
            <strong className="wx-inline">
              <WeatherArrow direction={weather.windDir} />
              {weather.windKnots.toFixed(0)}
              <small>KT</small>
            </strong>
            <span className="mini-note">
              {weather.waveM !== null ? `${weather.waveM.toFixed(1)}M SEA` : weather.weatherLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="topbar-right">
        <div className="clock-block">
          <span className="clock-time">{clock.time}</span>
          <span className="clock-meta">UTC · {clock.date}</span>
        </div>
        <div className="topbar-rule" />
        <button className="icon-button sources-button" type="button" onClick={onOpenSources}>
          <Database size={15} strokeWidth={1.6} />
          <span>SOURCES</span>
        </button>
        <div className="topbar-rule" />
        <button
          className="icon-button icon-button--square"
          type="button"
          aria-label="Open data and system settings"
          onClick={onOpenSources}
        >
          <Settings2 size={16} strokeWidth={1.5} />
        </button>
        <div className="uplink">
          <Radio size={13} strokeWidth={1.5} />
          <span>UPLINK</span>
          <i />
        </div>
      </div>
    </header>
  )
}
