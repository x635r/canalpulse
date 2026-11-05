import { useCallback, useEffect, useState } from 'react'
import { fetchPortWatchTransits, type TransitMap } from '../data/portwatch'

export interface PortWatchState {
  transits: TransitMap
  status: 'idle' | 'loading' | 'live' | 'error'
  error: string | null
  refresh: () => void
}

const REFRESH_MS = 30 * 60_000

/**
 * Loads real transit counts from IMF PortWatch. These replace the previously
 * hand-written queue figures, so the dashboard's headline numbers are traceable
 * to a published source.
 */
export function usePortWatch(): PortWatchState {
  const [transits, setTransits] = useState<TransitMap>({})
  const [status, setStatus] = useState<PortWatchState['status']>('loading')
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    ;(async () => {
      try {
        const data = await fetchPortWatchTransits(controller.signal)
        if (cancelled) return
        setTransits(data)
        setError(null)
        setStatus(Object.keys(data).length > 0 ? 'live' : 'error')
        if (Object.keys(data).length === 0) {
          setError('PortWatch returned no matching chokepoints')
        }
      } catch (cause) {
        if (cancelled || controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : 'PortWatch unavailable')
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [tick])

  useEffect(() => {
    const interval = window.setInterval(refresh, REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [refresh])

  return { transits, status, error, refresh }
}
