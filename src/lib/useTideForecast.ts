import { useEffect, useState } from 'react'
import type { ChokepointId } from '../types'
import { fetchTideForecast, type TideForecast } from '../data/tides'

/**
 * Tide forecast for the selected waterway. Waterways without an authoritative
 * free source return `status: 'unavailable'` rather than an invented curve.
 */
export function useTideForecast(chokepointId: ChokepointId): TideForecast | null {
  const [forecast, setForecast] = useState<TideForecast | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    ;(async () => {
      try {
        const data = await fetchTideForecast(chokepointId, controller.signal)
        if (!cancelled) setForecast(data)
      } catch {
        if (cancelled) return
        setForecast({
          status: 'unavailable',
          station: '—',
          stationName: '—',
          datum: '—',
          points: [],
          highWater: Number.NaN,
          lowWater: Number.NaN,
          note: '潮汐预报请求失败',
        })
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [chokepointId])

  return forecast
}
