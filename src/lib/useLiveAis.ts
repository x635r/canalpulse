import { useCallback, useEffect, useRef, useState } from 'react'
import type { Vessel } from '../types'
import { fetchLiveAis, liveAisToVessels, type LiveAisSnapshot } from '../data/liveAis'

export interface LiveAisState {
  vessels: Vessel[]
  status: 'idle' | 'loading' | 'live' | 'error'
  fetchedAt: number | null
  count: number
  error: string | null
  refresh: () => void
}

const REFRESH_MS = 60_000

/**
 * Polls the Digitraffic open AIS feed. Coverage is the Baltic Sea only — that is
 * a data-availability limit, not a bug: the global commercial feeds all need
 * credentials, so they stay behind the documented proxy boundary.
 */
export function useLiveAis(enabled: boolean): LiveAisState {
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [status, setStatus] = useState<LiveAisState['status']>('idle')
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((value) => value + 1), [])

  useEffect(() => {
    // Disabled state is derived during render, so the effect only has to run
    // the network side for the enabled case.
    if (!enabled) return

    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    let cancelled = false
    ;(async () => {
      setStatus((current) => (current === 'live' ? 'live' : 'loading'))
      try {
        const snapshot: LiveAisSnapshot = await fetchLiveAis(controller.signal)
        if (cancelled) return
        const live = liveAisToVessels(snapshot)
        setVessels(live)
        setFetchedAt(snapshot.fetchedAt)
        setError(null)
        setStatus('live')
      } catch (cause) {
        if (cancelled || controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : 'AIS feed unavailable')
        setStatus('error')
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
    vessels: enabled ? vessels : [],
    status: enabled ? status : 'idle',
    fetchedAt,
    count: enabled ? vessels.length : 0,
    error,
    refresh,
  }
}
