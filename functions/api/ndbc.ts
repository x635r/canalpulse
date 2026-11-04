/**
 * Proxy for the NOAA NDBC latest-observations feed.
 *
 * NDBC does not send an Access-Control-Allow-Origin header, so the browser
 * cannot read it directly. This Pages Function fetches it server-side and
 * re-serves it with CORS enabled plus a short edge cache, since the feed only
 * updates hourly.
 */
const NDBC_URL = 'https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt'

export const onRequestGet: PagesFunction = async () => {
  const upstream = await fetch(NDBC_URL, {
    headers: { 'User-Agent': 'CanalPulse/1.0 (ocean shipping dashboard)' },
    cf: { cacheTtl: 600, cacheEverything: true },
  })

  if (!upstream.ok) {
    return new Response(`Upstream NDBC error: ${upstream.status}`, {
      status: 502,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  }

  const body = await upstream.text()
  return new Response(body, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  })
}
