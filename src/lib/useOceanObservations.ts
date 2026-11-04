import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchBuoys,
  fetchQuakes,
  type BuoyObservation,
  type SeismicEvent,
} from '../data/oceanObservations'

export interface OceanObservationState {
  buoys: BuoyObservation[]
  quakes: SeismicEvent[]
  status: 'idle' | 'loading' | 'live' | 'partial' | 'error'
  error: string | null
  fetchedAt: number | null
  refresh: () => void
}

const REFRESH_MS = 10 * 60_000

/**
 * Loads live buoy and seismic observations. Both feeds are independent, so a
 * failure in one degrades to "partial" rather than blanking the other.
 */
export function useOceanObservations(enabled: boolean): OceanObservationState {
  const [buoys, setBuoys] = useState<BuoyObservation[]>([])
  const [quakes, setQuakes] = useState<SeismicEvent[]>([])
  const [status, setStatus] = useState<OceanObservationState['status']>('idle')
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [tick, setTick] = useState(0)
  const controllerRef = useRef<AbortController | null>(null)

  const refresh = useCallback(() => setTick((value) => value + 1), [])

  useEffect(() => {
    if (!enabled) return

    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    let cancelled = false

    ;(async () => {
      setStatus((current) => (current === 'live' ? 'live' : 'loading'))

      const [buoyResult, quakeResult] = await Promise.allSettled([
        fetchBuoys(controller.signal),
        fetchQuakes(controller.signal),
      ])
      if (cancelled) return

      const buoyOk = buoyResult.status === 'fulfilled'
      const quakeOk = quakeResult.status === 'fulfilled'

      if (buoyOk) setBuoys(buoyResult.value)
      if (quakeOk) setQuakes(quakeResult.value)

      if (buoyOk || quakeOk) {
        setFetchedAt(Date.now())
        setStatus(buoyOk && quakeOk ? 'live' : 'partial')
        const failure = !buoyOk ? buoyResult : !quakeOk ? quakeResult : null
        setError(
          failure && failure.status === 'rejected'
            ? String(failure.reason instanceof Error ? failure.reason.message : failure.reason)
            : null,
        )
      } else {
        setStatus('error')
        setError('Ocean observation feeds unavailable')
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [enabled, tick])

  useEffect(() => {
    if (!enabled) return
    const interval = window.setInterval(refresh, REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [enabled, refresh])

  return {
    buoys: enabled ? buoys : [],
    quakes: enabled ? quakes : [],
    status: enabled ? status : 'idle',
    error,
    fetchedAt,
    refresh,
  }
}
