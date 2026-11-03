import { useEffect, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'

export interface GraticuleState {
  centerLng: number
  centerLat: number
  zoom: number
}

export interface ScaleState {
  metres: number
  pixels: number
  label: string
}

// Nautical charts label the scale bar in whole nautical miles or round metres,
// so candidate steps are built in those units rather than plain metres.
const NM = 1852
const NICE_STEPS = [
  10, 20, 50, 100, 200, 500,
  0.1 * NM, 0.2 * NM, 0.5 * NM,
  NM, 2 * NM, 5 * NM, 10 * NM, 20 * NM, 50 * NM, 100 * NM, 200 * NM,
]

function formatDistance(metres: number) {
  if (metres >= 0.95 * NM) {
    const nm = metres / NM
    return `${nm >= 10 ? Math.round(nm) : nm.toFixed(1)} NM`
  }
  return `${Math.round(metres)} M`
}

/** Metres per pixel at the given latitude and zoom, Web Mercator. */
function metresPerPixel(lat: number, zoom: number) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom)
}

export function useChartProbe(map: MapLibreMap | null) {
  const [graticule, setGraticule] = useState<GraticuleState>({
    centerLng: 0,
    centerLat: 0,
    zoom: 2,
  })
  const [scale, setScale] = useState<ScaleState>({ metres: 0, pixels: 0, label: '—' })

  useEffect(() => {
    if (!map) return

    let frame = 0
    const measure = () => {
      frame = 0
      const center = map.getCenter()
      const zoom = map.getZoom()
      const mpp = metresPerPixel(center.lat, zoom)

      // Target a bar roughly 110 device pixels wide, snapped to a round value.
      const target = 110 * mpp
      const step =
        NICE_STEPS.find((value) => value >= target) ?? NICE_STEPS[NICE_STEPS.length - 1]

      setGraticule({ centerLng: center.lng, centerLat: center.lat, zoom })
      setScale({ metres: step, pixels: step / mpp, label: formatDistance(step) })
    }

    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(measure)
    }

    measure()
    map.on('move', schedule)
    map.on('zoom', schedule)
    map.on('resize', schedule)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      map.off('move', schedule)
      map.off('zoom', schedule)
      map.off('resize', schedule)
    }
  }, [map])

  return { graticule, scale }
}
