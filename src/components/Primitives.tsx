import type { ReactNode } from 'react'
import type { ChokepointId, StatusTone } from '../types'

export function LogoMark() {
  return (
    <svg className="logo-mark" viewBox="0 0 52 52" aria-hidden="true">
      <circle className="logo-orbit logo-orbit--outer" cx="26" cy="26" r="24" />
      <circle className="logo-orbit logo-orbit--inner" cx="26" cy="26" r="17" />
      <path className="logo-tick" d="M26 1v5M26 46v5M1 26h5M46 26h5" />
      <path className="logo-canal" d="M21 39c1.4-6 1.6-9 2.2-13 .5-3 1.3-5 2.4-8.6.8-2.8 2-4.9 4-7.4" />
      <path className="logo-canal logo-canal--offset" d="M26.5 40c1-5.4 1.1-8.8 2.1-13.3.7-3.2 1.3-5.4 2.9-8.7 1.2-2.4 2.6-4.4 4.1-6" />
      <circle className="logo-pip" cx="34.8" cy="18.4" r="2.4" />
      <path className="logo-crosshair" d="M26 20v12M20 26h12" />
    </svg>
  )
}

export function ChokeGlyph({ id, className = '' }: { id: ChokepointId; className?: string }) {
  const glyphs: Record<ChokepointId, ReactNode> = {
    suez: (
      <>
        <path d="M25 4v9l-4 8 3 9-2 7 3 11" />
        <path d="M31 4v7l-3 7 3 8-2 10 2 12" opacity=".42" />
        <path d="M14 17h7M30 17h8M17 37h8M30 37h5" opacity=".55" />
        <circle cx="24" cy="30" r="2.4" />
      </>
    ),
    panama: (
      <>
        <path d="M4 21h7v8h9V16h6v7h8v-7h11" />
        <path d="M4 37h9v-8h8v5h9v-8h7v10h8" opacity=".46" />
        <circle cx="23" cy="25" r="2.4" />
        <path d="M12 8l3 5M42 44l-4-6" opacity=".5" />
      </>
    ),
    malacca: (
      <>
        <path d="M8 9c7 8 11 11 18 14 7 3 9 7 15 14" />
        <path d="M16 4c7 9 10 13 18 17 7 4 10 8 14 16" opacity=".38" />
        <path d="M4 32c9-2 16-2 24 0 7 2 12 6 16 10" opacity=".24" />
        <circle cx="27" cy="22" r="2.4" />
        <path d="M7 5l6 6M39 43l5 4" opacity=".6" />
      </>
    ),
    bosphorus: (
      <>
        <path d="M30 3c-4 7-5 10-2 15 4 7 7 8 3 14-4 7-8 8-5 16" />
        <path d="M24 4c-3 6-2 10 1 16 3 6 7 9 3 15-3 5-7 7-4 12" opacity=".45" />
        <circle cx="27" cy="26" r="2.4" />
        <path d="M14 12h8M35 12h8M14 34h7M34 34h7" opacity=".4" />
      </>
    ),
    hormuz: (
      <>
        <path d="M4 14c9 2 15 5 21 9 6 4 10 9 14 13" />
        <path d="M30 8c-6 4-9 7-12 12-3 5-4 11-3 16" opacity=".45" />
        <circle cx="26" cy="24" r="2.4" />
        <path d="M8 30l5-4M38 34l5 4M20 6l3 5" opacity=".5" />
      </>
    ),
    gibraltar: (
      <>
        <path d="M6 18h13l6-6" />
        <path d="M46 34H33l-6 6" opacity=".5" />
        <path d="M4 34h10M38 18h10" opacity=".55" />
        <circle cx="26" cy="26" r="2.4" />
        <path d="M20 22l-4-4M32 30l4 4" opacity=".4" />
      </>
    ),
    'bab-el-mandeb': (
      <>
        <path d="M8 8v10l10 6v12" />
        <path d="M44 44V34l-10-6V16" opacity=".5" />
        <circle cx="26" cy="26" r="2.4" />
        <path d="M18 26h5M29 26h5" opacity=".55" />
        <path d="M22 14c2 4 3 7 3 12s-1 8-3 12" opacity=".35" />
      </>
    ),
    dover: (
      <>
        <path d="M4 20h14l4 4h8" />
        <path d="M48 32H34l-4-4h-8" opacity=".5" />
        <path d="M4 32h9M39 20h9" opacity=".55" />
        <circle cx="26" cy="26" r="2.4" />
        <path d="M26 12v6M26 34v6" opacity=".4" />
      </>
    ),
  }

  return (
    <svg className={`choke-glyph ${className}`} viewBox="0 0 52 52" aria-hidden="true">
      <circle className="choke-glyph-ring" cx="27" cy="26" r="24" />
      <g className="choke-glyph-geometry">{glyphs[id]}</g>
    </svg>
  )
}

export function Sparkline({
  data,
  color = '#69d8bd',
  className = '',
  width = 140,
  height = 32,
}: {
  data: number[]
  color?: string
  className?: string
  width?: number
  height?: number
}) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - ((value - min) / range) * (height - 5) - 2.5
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
  const fillPoints = `0,${height} ${points} ${width},${height}`
  const id = `spark-${data.join('-').replace(/\W/g, '').slice(0, 22)}`

  return (
    <svg className={`sparkline ${className}`} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".2" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" x2={width} y1={height - 2} y2={height - 2} className="sparkline-baseline" />
      <polygon points={fillPoints} fill={`url(#${id})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      <circle
        cx={width}
        cy={height - ((data[data.length - 1] - min) / range) * (height - 5) - 2.5}
        r="2"
        fill={color}
      />
    </svg>
  )
}

export function ToneDot({ tone }: { tone: StatusTone }) {
  return <span className={`tone-dot tone-dot--${tone}`} aria-hidden="true" />
}

export function WeatherArrow({ direction, color = 'currentColor' }: { direction: number; color?: string }) {
  return (
    <svg className="weather-arrow" viewBox="0 0 24 24" style={{ color }} aria-hidden="true">
      <g transform={`rotate(${direction} 12 12)`}>
        <path d="M12 2v14M6.5 10.5 12 16l5.5-5.5" />
        <circle cx="12" cy="21" r="1.4" />
      </g>
    </svg>
  )
}

export function ShipGlyph({ type, direction = 'in' }: { type: string; direction?: 'in' | 'out' }) {
  return (
    <svg
      className={`ship-glyph ship-glyph--${type} ${direction === 'out' ? 'is-out' : ''}`}
      viewBox="0 0 30 48"
      aria-hidden="true"
    >
      <path className="ship-hull" d="M15 1.8 25.5 30l-3.2 15.4h-14.6L4.5 30Z" />
      <path className="ship-deck" d="M9.1 17h11.8l2.1 11H7Z" />
      {type === 'container' && (
        <g className="ship-cargo">
          <path d="M9.8 20h2v2.2h-2zM13 20h2v2.2h-2zM16.2 20h2v2.2h-2zM19.4 20h2v2.2h-2z" />
          <path d="M9.4 23.6h2v2.2h-2zM12.6 23.6h2v2.2h-2zM15.8 23.6h2v2.2h-2zM19 23.6h2v2.2h-2z" opacity=".55" />
        </g>
      )}
      {type === 'bulk' && (
        <path className="ship-hatch" d="M10 20h3v2.4h-3zM15 20h3v2.4h-3zM20 20h1.6v2.4H20z" />
      )}
      {type === 'lng' && (
        <g className="ship-spheres">
          <circle cx="12" cy="21.5" r="2.1" />
          <circle cx="16" cy="21.5" r="2.1" />
          <circle cx="20" cy="21.5" r="2.1" />
        </g>
      )}
      {type === 'vlcc' && <path className="ship-manifold" d="M10 22h11M13 24.8h6" />}
      <path className="ship-bridge" d="M12 12.8h6v3.8h-6z" />
      <path className="ship-bow" d="M12 4h6l1.6 6.5H10.4Z" />
    </svg>
  )
}
