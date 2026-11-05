import { useEffect, useState } from 'react'

/**
 * Keeps a small slice of view state in the URL so a specific chart can be
 * shared or bookmarked — e.g. `?gate=hormuz&mode=bathymetry&layers=sst,buoys`.
 *
 * Only the shareable dimensions live here; transient things (selected hull,
 * simulation speed) stay in component state.
 */
export interface UrlState {
  gate: string
  mode: string
  layers: string[]
}

function readUrl(): UrlState {
  const params = new URLSearchParams(window.location.search)
  return {
    gate: params.get('gate') ?? '',
    mode: params.get('mode') ?? '',
    layers: (params.get('layers') ?? '').split(',').filter(Boolean),
  }
}

function writeUrl(state: UrlState) {
  const params = new URLSearchParams()
  if (state.gate) params.set('gate', state.gate)
  if (state.mode) params.set('mode', state.mode)
  if (state.layers.length > 0) params.set('layers', state.layers.join(','))

  const query = params.toString()
  const next = `${window.location.pathname}${query ? `?${query}` : ''}`
  // replaceState keeps the back button clean while the operator pans around.
  if (next !== `${window.location.pathname}${window.location.search}`) {
    window.history.replaceState(null, '', next)
  }
}

export function useUrlState() {
  const [initial] = useState<UrlState>(readUrl)

  const sync = (state: UrlState) => writeUrl(state)

  // Re-read when the user navigates back/forward to a shared link.
  useEffect(() => {
    const onPop = () => window.location.reload()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return { initial, sync }
}
