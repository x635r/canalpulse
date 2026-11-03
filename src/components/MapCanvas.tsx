import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import {
  Map as MapLibreMap,
  Marker,
  setWorkerUrl,
  type GeoJSONSource,
} from 'maplibre-gl'
import type { Feature, FeatureCollection } from 'geojson'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Chokepoint, ChokepointId, MapMode, Vessel } from '../types'
import { everGiven } from '../data/blockade'
import { vesselTypes } from '../data/fleet'
import { chokepoints } from '../data/chokepoints'
import { bearingBetween, circlePolygon, clamp, pointAlong } from '../lib/geo'
import { getReconState } from '../lib/blockade'
import { chartStyle } from '../lib/mapStyle'

setWorkerUrl(workerUrl)

export interface MapCanvasHandle {
  zoomIn: () => void
  zoomOut: () => void
  recenter: () => void
  getMap: () => MapLibreMap | null
}

interface MapCanvasProps {
  chokepoint: Chokepoint
  vessels: Vessel[]
  liveVessels?: Vessel[]
  selectedId: string
  mode: MapMode
  onSelectVessel: (id: string) => void
  onSelectChokepoint?: (id: ChokepointId) => void
  reconProgress: number
  onMapReady?: (map: MapLibreMap) => void
}

type MoveVessel = {
  vessel: Vessel
  marker: Marker
  headingEl: HTMLElement | null
  baseProgress: number
  speed: number
  direction: 'in' | 'out'
}

const ROUTE_SOURCE = 'cp-route'
const ANCHORAGE_SOURCE = 'cp-anchorages'
const HEAT_SOURCE = 'cp-heat'
const WAYPOINT_SOURCE = 'cp-waypoints'
const LIVE_AIS_SOURCE = 'cp-live-ais'
const LIVE_AIS_LAYER = 'live-ais-hulls'
const BLOCKADE_SOURCE = 'cp-blockade-zone'
const RECON_QUEUE_SOURCE = 'cp-recon-queue'
const BATHY_SOURCE = 'emodnet-bathy'
const BATHY_GLOBAL_SOURCE = 'gebco-bathy'
const SEAMARK_SOURCE = 'openseamap-seamark'
const SEAMARK_LAYER = 'seamark-overlay'

function featureCollection(features: Feature[]): FeatureCollection {
  return { type: 'FeatureCollection', features }
}

function anchorageFeatures(chokepoint: Chokepoint): FeatureCollection {
  return featureCollection(
    chokepoint.anchorages.map((anchorage) => ({
      ...circlePolygon(anchorage.coord, anchorage.radiusKm, 56),
      properties: {
        name: anchorage.name,
        utilization: anchorage.utilization,
      },
    })),
  )
}

function heatFeatures(vessels: Vessel[], chokepoint: Chokepoint): FeatureCollection {
  const points = vessels
    .filter((vessel) => vessel.status === 'anchored' && vessel.position)
    .map((vessel) => ({
      type: 'Feature' as const,
      properties: {
        wait: vessel.waitHours,
        type: vessel.type,
        weight: clamp(vessel.waitHours / 30, 0.25, 1.4),
      },
      geometry: {
        type: 'Point' as const,
        coordinates: vessel.position as [number, number],
      },
    }))

  void chokepoint
  return featureCollection(points)
}

function liveAisFeatures(vessels: Vessel[]): FeatureCollection {
  const features: Feature[] = []
  for (const vessel of vessels) {
    if (!vessel.position) continue
    features.push({
      type: 'Feature',
      properties: {
        id: vessel.id,
        name: vessel.name,
        type: vessel.type,
        heading: vessel.heading,
        sog: vessel.speed,
        status: vessel.status,
        color: vesselTypes[vessel.type].color,
      },
      geometry: { type: 'Point', coordinates: vessel.position },
    })
  }
  return featureCollection(features)
}

function waypointFeatures(chokepoint: Chokepoint): FeatureCollection {
  return featureCollection(
    chokepoint.waypoints.map((waypoint) => ({
      type: 'Feature' as const,
      properties: {
        name: waypoint.name,
        kind: waypoint.kind,
        zh: waypoint.labelZh,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: waypoint.coord,
      },
    })),
  )
}

function blockadeZone(): FeatureCollection {
  // The blocking line runs bank-to-bank across the canal at the km 151
  // grounding point, so it is derived from the real centreline coordinate.
  const [lng, lat] = everGiven.blockCoord
  return featureCollection([
    circlePolygon(everGiven.blockCoord, 1.5, 36),
    {
      type: 'Feature',
      properties: { kind: 'crossing' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [lng - 0.0012, lat - 0.0016],
          [lng + 0.0012, lat + 0.0016],
        ],
      },
    },
  ])
}

function reconQueue(count: number, chokepoint: Chokepoint): FeatureCollection {
  let seed = 9173
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const features: Feature[] = []
  const north = chokepoint.route[0]
  const south = chokepoint.route[chokepoint.route.length - 1]
  const mid = pointAlong(chokepoint.route, 0.62)
  const zones = [
    { center: north, spread: 0.075, weight: 0.49 },
    { center: mid, spread: 0.035, weight: 0.2 },
    { center: south, spread: 0.07, weight: 0.31 },
  ]

  for (let index = 0; index < count; index += 1) {
    let pick = random()
    let zone = zones[0]
    for (const entry of zones) {
      if (pick < entry.weight) {
        zone = entry
        break
      }
      pick -= entry.weight
    }
    const x = zone.center[0] + (random() - 0.5) * zone.spread * 2.6
    const y = zone.center[1] + (random() - 0.5) * zone.spread * 2.2
    features.push({
      type: 'Feature',
      properties: {
        dwell: Math.round(6 + random() * 44),
        hull: index,
      },
      geometry: { type: 'Point', coordinates: [x, y] },
    })
  }
  return featureCollection(features)
}


function createShipSvg(type: string) {
  return `<svg viewBox="0 0 30 46" aria-hidden="true" class="map-ship-svg">
    <path class="ms-hull" d="M15 2 24.5 28 21.5 44h-13L5.5 28Z" />
    <path class="ms-deck" d="M9.5 17h11l1.8 10.4H7.7Z" />
    <path class="ms-cargo" d="M10 19.2h2.1v2.2H10zM13 19.2h2.1v2.2H13zM16 19.2h2.1v2.2H16zM19 19.2h2.1v2.2H19zM10 22.2h2.1v2.2H10zM13 22.2h2.1v2.2H13zM16 22.2h2.1v2.2H16zM19 22.2h2.1v2.2H19z" />
    <path class="ms-bridge" d="M11.8 12h6.4v4h-6.4z" />
    <path class="ms-bow" d="M12 3.6h6l1.3 5.7H10.7Z" />
    <path class="ms-detail" d="M8 31h14M9.5 36h11" />
    <title>${type}</title>
  </svg>`
}

function createVesselElement(vessel: Vessel, selected: boolean): HTMLElement {
  const meta = vesselTypes[vessel.type]
  const element = document.createElement('button')
  element.type = 'button'
  element.className = `vessel-marker vessel-marker--${vessel.status} vessel-marker--${vessel.type}${
    selected ? ' is-selected' : ''
  }`
  element.style.setProperty('--vessel-color', meta.color)
  element.style.setProperty('--vessel-soft', meta.softColor)
  element.setAttribute('aria-label', `${vessel.name}, ${meta.label}, ${vessel.status}`)

  if (vessel.status === 'anchored') {
    element.innerHTML = `
      <span class="vessel-halo"></span>
      <span class="vessel-core"><i>${meta.code}</i></span>
      <span class="vessel-tag"><strong>${vessel.name}</strong><em>${meta.label} / ${vessel.waitHours.toFixed(1)}H WAIT</em></span>
    `
  } else {
    element.innerHTML = `
      <span class="vessel-wake"></span>
      <span class="vessel-heading">${createShipSvg(vessel.type)}</span>
      <span class="vessel-tag"><strong>${vessel.name}</strong><em>${meta.label} / ${vessel.speed.toFixed(1)}KN / ${vessel.destination}</em></span>
      <span class="vessel-vector"></span>
    `
  }
  return element
}

function fitWorld(map: MapLibreMap, duration = 900) {
  const coords = chokepoints.map((entry) => entry.center)
  const lngs = coords.map((c) => c[0])
  const lats = coords.map((c) => c[1])
  const west = Math.min(...lngs)
  const east = Math.max(...lngs)
  const south = Math.min(...lats)
  const north = Math.max(...lats)
  // The gates span ~180° of longitude (Panama to Malacca), so the global chart
  // needs to zoom out well past the per-gate maxZoom. No maxZoom cap here —
  // clamping it left Panama and Malacca off-screen entirely.
  map.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    {
      padding: { top: 70, bottom: 90, left: 60, right: 60 },
      duration,
      essential: true,
    },
  )
}

function fitChart(map: MapLibreMap, chokepoint: Chokepoint, duration = 1050) {
  const coordinates = [
    ...chokepoint.route,
    ...chokepoint.waypoints.map((waypoint) => waypoint.coord),
    ...chokepoint.anchorages.map((anchorage) => anchorage.coord),
  ]
  const lngs = coordinates.map((coordinate) => coordinate[0])
  const lats = coordinates.map((coordinate) => coordinate[1])
  const padding = 0.055
  const west = Math.min(...lngs) - padding
  const east = Math.max(...lngs) + padding
  const south = Math.min(...lats) - padding
  const north = Math.max(...lats) + padding
  map.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    {
      padding: { top: 64, bottom: 96, left: 28, right: 28 },
      maxZoom: chokepoint.zoom + 3.5,
      duration,
      essential: true,
    },
  )
}

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(
  {
    chokepoint,
    vessels,
    liveVessels,
    selectedId,
    mode,
    onSelectVessel,
    onSelectChokepoint,
    reconProgress,
    onMapReady,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const loadedRef = useRef(false)
  const vesselsRef = useRef<Vessel[]>(vessels)
  const liveVesselsRef = useRef<Vessel[]>(liveVessels ?? [])
  const selectedRef = useRef(selectedId)
  const callbacksRef = useRef(onSelectVessel)
  const routeRef = useRef(chokepoint.route)
  const markersRef = useRef<Map<string, Marker>>(new Map())
  const movingRef = useRef<MoveVessel[]>([])
  const arrowMarkersRef = useRef<Marker[]>([])
  const blockadeMarkerRef = useRef<Marker | null>(null)
  const gateMarkersRef = useRef<Marker[]>([])
  const gateClickRef = useRef(onSelectChokepoint)
  useEffect(() => {
    gateClickRef.current = onSelectChokepoint
  }, [onSelectChokepoint])
  const blockadeHullRef = useRef<HTMLElement | null>(null)
  const onMapReadyRef = useRef(onMapReady)
  useEffect(() => {
    onMapReadyRef.current = onMapReady
  }, [onMapReady])
  const reconStateRef = useRef(getReconState(reconProgress))
  const mapModeRef = useRef<MapMode>(mode)
  const [webglFailed] = useState(() => {
    if (typeof document === 'undefined') return false
    return !document.createElement('canvas').getContext('webgl2')
  })
  const [chartReady, setChartReady] = useState(false)

  useEffect(() => {
    vesselsRef.current = vessels
    selectedRef.current = selectedId
    callbacksRef.current = onSelectVessel
    reconStateRef.current = getReconState(reconProgress)
    mapModeRef.current = mode
    routeRef.current = chokepoint.route
  }, [vessels, selectedId, onSelectVessel, reconProgress, mode, chokepoint.route])

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn({ duration: 350 }),
    zoomOut: () => mapRef.current?.zoomOut({ duration: 350 }),
    recenter: () => {
      if (mapRef.current) fitChart(mapRef.current, chokepoint)
    },
    getMap: () => mapRef.current,
  }))

  const syncSources = useCallback(
    (target: Chokepoint) => {
      const map = mapRef.current
      if (!map || !loadedRef.current) return

      const routeSource = map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined
      routeSource?.setData({
        type: 'Feature',
        properties: {
          label: `${target.name} / ${target.axis.primary}`,
        },
        geometry: { type: 'LineString', coordinates: target.route },
      })

      const anchorageSource = map.getSource(ANCHORAGE_SOURCE) as GeoJSONSource | undefined
      anchorageSource?.setData(anchorageFeatures(target))

      const heatSource = map.getSource(HEAT_SOURCE) as GeoJSONSource | undefined
      heatSource?.setData(heatFeatures(vesselsRef.current, target))

      const waypointSource = map.getSource(WAYPOINT_SOURCE) as GeoJSONSource | undefined
      waypointSource?.setData(waypointFeatures(target))

      const reconSource = map.getSource(RECON_QUEUE_SOURCE) as GeoJSONSource | undefined
      const progress = mapModeRef.current === 'recon' ? reconStateRef.current : null
      reconSource?.setData(
        progress ? reconQueue(progress.queue, target) : featureCollection([]),
      )
    },
    [],
  )

  const rebuildMarkers = useCallback((target: Chokepoint) => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current.clear()
    arrowMarkersRef.current.forEach((marker) => marker.remove())
    arrowMarkersRef.current = []
    movingRef.current = []

    vesselsRef.current.forEach((vessel) => {
      const isSelected = vessel.id === selectedRef.current
      const element = createVesselElement(vessel, isSelected)
      element.addEventListener('click', (event) => {
        event.stopPropagation()
        callbacksRef.current(vessel.id)
      })
      const coordinate =
        vessel.status === 'anchored' && vessel.position
          ? vessel.position
          : pointAlong(target.route, vessel.progress)

      const marker = new Marker({ element, anchor: 'center' })
        .setLngLat(coordinate)
        .addTo(map)
      markersRef.current.set(vessel.id, marker)

      if (vessel.status !== 'anchored') {
        const headingEl = element.querySelector<HTMLElement>('.vessel-heading')
        const pointAhead = pointAlong(
          target.route,
          vessel.direction === 'in' ? vessel.progress + 0.005 : vessel.progress - 0.005,
        )
        const bearing = bearingBetween(coordinate, pointAhead)
        if (headingEl) {
          headingEl.style.transform = `rotate(${vessel.direction === 'in' ? bearing : bearing + 180}deg)`
        }
        movingRef.current.push({
          vessel,
          marker,
          headingEl,
          baseProgress: vessel.progress,
          speed: vessel.speed,
          direction: vessel.direction,
        })
      }
    })

    for (let index = 0; index < 8; index += 1) {
      const fraction = 0.08 + index * 0.12
      const coordinate = pointAlong(target.route, fraction)
      const next = pointAlong(target.route, fraction + 0.008)
      const bearing = bearingBetween(coordinate, next)
      const element = document.createElement('div')
      element.className = 'route-arrow'
      element.setAttribute('aria-hidden', 'true')
      element.innerHTML = `<span style="transform: rotate(${bearing}deg)"><svg viewBox="0 0 12 16" aria-hidden="true"><path d="M6 1 10.5 14 6 11.4 1.5 14Z" /></svg></span>`
      const marker = new Marker({
        element,
        anchor: 'center',
      })
        .setLngLat(coordinate)
        .addTo(map)
      arrowMarkersRef.current.push(marker)
    }
  }, [])

  const initialConfigRef = useRef({ chokepoint, syncSources, rebuildMarkers })

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const { chokepoint: initialChokepoint, syncSources: initialSyncSources, rebuildMarkers: initialRebuildMarkers } =
      initialConfigRef.current
    const vesselMarkers = markersRef.current
    const arrowMarkers = arrowMarkersRef.current
    let map: MapLibreMap
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: chartStyle,
        center: initialChokepoint.center,
        zoom: initialChokepoint.zoom,
        bearing: 0,
        pitch: 0,
        minZoom: 1,
        maxZoom: 17,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        renderWorldCopies: false,
        fadeDuration: 220,
      })
    } catch {
      return
    }

    mapRef.current = map
    if (import.meta.env.DEV) {
      ;(window as typeof window & { __canalMap?: MapLibreMap }).__canalMap = map
    }
    onMapReadyRef.current?.(map)
    map.on('error', (event) => {
      const sourceId = (event as { sourceId?: string }).sourceId ?? ''
      if (
        sourceId !== BATHY_SOURCE &&
        sourceId !== BATHY_GLOBAL_SOURCE &&
        sourceId !== SEAMARK_SOURCE &&
        sourceId !== 'openmaptiles' &&
        !String(event.error?.message ?? '').includes('429') &&
        !String(event.error?.message ?? '').includes('Failed to fetch')
      ) {
        console.warn('[CanalPulse chart]', event.error)
      }
    })

    map.on('load', () => {
      loadedRef.current = true
      setChartReady(true)

      map.addSource(ROUTE_SOURCE, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {
            label: `${initialChokepoint.name} / ${initialChokepoint.axis.primary}`,
          },
          geometry: { type: 'LineString', coordinates: initialChokepoint.route },
        },
      })
      map.addSource(ANCHORAGE_SOURCE, { type: 'geojson', data: anchorageFeatures(initialChokepoint) })
      map.addSource(HEAT_SOURCE, { type: 'geojson', data: heatFeatures(vesselsRef.current, initialChokepoint) })
      map.addSource(WAYPOINT_SOURCE, { type: 'geojson', data: waypointFeatures(initialChokepoint) })
      map.addSource(LIVE_AIS_SOURCE, { type: 'geojson', data: liveAisFeatures(liveVesselsRef.current) })
      map.addSource(BLOCKADE_SOURCE, { type: 'geojson', data: blockadeZone() })
      map.addSource(RECON_QUEUE_SOURCE, { type: 'geojson', data: featureCollection([]) })

      map.addLayer({
        id: 'anchorage-fill',
        type: 'fill',
        source: ANCHORAGE_SOURCE,
        paint: {
          'fill-color': '#d8b86e',
          'fill-opacity': 0.07,
        },
      })
      map.addLayer({
        id: 'anchorage-outline',
        type: 'line',
        source: ANCHORAGE_SOURCE,
        paint: {
          'line-color': '#8fb7a5',
          'line-opacity': 0.48,
          'line-width': 0.9,
          'line-dasharray': [5, 4],
        },
      })
      map.addSource(BATHY_SOURCE, {
        type: 'raster',
        tiles: [
          'https://ows.emodnet-bathymetry.eu/wms?service=WMS&request=GetMap&version=1.1.1&layers=emodnet:mean_multicolour&styles=&format=image/png&transparent=true&width=256&height=256&srs=EPSG:3857&bbox={bbox-epsg-3857}',
        ],
        tileSize: 256,
        maxzoom: 12,
        attribution: 'Bathymetry © EMODnet / GEBCO',
      })
      // EMODnet only covers European seas; GEBCO is the global fallback so the
      // Panama / Malacca / Bosphorus charts are not blank in BATHY mode.
      map.addSource(BATHY_GLOBAL_SOURCE, {
        type: 'raster',
        tiles: [
          'https://wms.gebco.net/mapserv?request=GetMap&service=WMS&version=1.3.0&layers=GEBCO_LATEST&styles=&format=image/png&transparent=true&width=256&height=256&crs=EPSG:3857&bbox={bbox-epsg-3857}',
        ],
        tileSize: 256,
        maxzoom: 9,
        attribution: 'Bathymetry © GEBCO',
      })
      map.addLayer({
        id: 'bathymetry-global',
        type: 'raster',
        source: BATHY_GLOBAL_SOURCE,
        layout: { visibility: 'visible' },
        paint: {
          'raster-opacity': 0.09,
          'raster-saturation': -0.15,
          'raster-contrast': 0.18,
          'raster-hue-rotate': 154,
          'raster-brightness-min': 0.02,
          'raster-brightness-max': 0.52,
        },
      })
      map.addLayer({
        id: 'bathymetry-raster',
        type: 'raster',
        source: BATHY_SOURCE,
        layout: { visibility: 'visible' },
        paint: {
          'raster-opacity': 0.09,
          'raster-saturation': -0.15,
          'raster-contrast': 0.18,
          'raster-hue-rotate': 154,
          'raster-brightness-min': 0.02,
          'raster-brightness-max': 0.52,
          'raster-resampling': 'linear',
        },
      })

      // OpenSeaMap raster seamarks: buoys, beacons, lights, TSS boundaries and
      // fairway marks. These are real chart symbols, not decoration, so the
      // chart reads as a nautical chart rather than a coloured gradient.
      map.addSource(SEAMARK_SOURCE, {
        type: 'raster',
        tiles: ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 18,
        attribution: 'Seamarks © OpenSeaMap / OpenStreetMap contributors',
      })
      map.addLayer({
        id: SEAMARK_LAYER,
        type: 'raster',
        source: SEAMARK_SOURCE,
        // Below z10 OpenSeaMap ships broad purple/red area fills (not point
        // symbols), which smear across the chart. Show seamarks from z10 up,
        // where the tiles carry real buoy / beacon / TSS marks.
        minzoom: 10,
        paint: {
          'raster-opacity': 0.82,
          'raster-saturation': -0.35,
          'raster-contrast': 0.12,
          'raster-brightness-max': 0.86,
          'raster-resampling': 'linear',
        },
      })

      map.addLayer({
        id: 'route-glow',
        type: 'line',
        source: ROUTE_SOURCE,
        paint: {
          'line-color': '#58e2c1',
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 8, 10, 26, 14, 68],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.05, 11, 0.12],
          'line-blur': 10,
        },
      })
      // Charted fairway: a translucent water band that widens with zoom so the
      // waterway reads as a navigable corridor, not a hairline.
      map.addLayer({
        id: 'route-fairway',
        type: 'line',
        source: ROUTE_SOURCE,
        paint: {
          'line-color': '#3fb99c',
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 3, 9, 9, 12, 26, 15, 60],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.1, 10, 0.18, 14, 0.24],
        },
      })
      map.addLayer({
        id: 'route-base',
        type: 'line',
        source: ROUTE_SOURCE,
        paint: {
          'line-color': '#68dfc3',
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.6, 10, 2.2, 14, 3],
          'line-opacity': 0.9,
        },
      })
      map.addLayer({
        id: 'route-centre',
        type: 'line',
        source: ROUTE_SOURCE,
        paint: {
          'line-color': '#d7f7ed',
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 12, 1],
          'line-opacity': 0.6,
          'line-dasharray': [2, 6],
        },
      })

      map.addLayer({
        id: 'route-label',
        type: 'symbol',
        source: ROUTE_SOURCE,
        minzoom: 5,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 6.5, 9, 8, 12, 9],
          'text-letter-spacing': 0.18,
          'text-transform': 'uppercase',
          'text-offset': [0, -0.8],
          'symbol-spacing': 380,
          'text-max-angle': 70,
        },
        paint: {
          'text-color': 'rgba(170, 222, 204, 0.7)',
          'text-halo-color': 'rgba(3, 13, 10, 0.9)',
          'text-halo-width': 1.6,
          'text-opacity': 0.8,
        },
      })

      map.addLayer({
        id: 'heat-glow',
        type: 'heatmap',
        source: HEAT_SOURCE,
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'wait'],
            0,
            0.12,
            24,
            0.7,
            50,
            1.25,
          ],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 10, 1.25],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 5, 18, 9, 40, 13, 65],
          'heatmap-opacity': 0.82,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(1, 18, 16, 0)',
            0.2,
            'rgba(40, 106, 88, 0.3)',
            0.42,
            'rgba(104, 223, 195, 0.42)',
            0.62,
            'rgba(216, 184, 110, 0.63)',
            0.8,
            'rgba(255, 131, 104, 0.8)',
            1,
            'rgba(255, 208, 171, 0.94)',
          ],
        },
      })

      map.addLayer({
        id: 'waypoint-dots',
        type: 'circle',
        source: WAYPOINT_SOURCE,
        paint: {
          'circle-radius': ['match', ['get', 'kind'], 'shoal', 3, 'lock', 3.2, 2.2],
          'circle-color': [
            'match',
            ['get', 'kind'],
            'shoal',
            '#ff8368',
            'lock',
            '#d8b86e',
            'port',
            '#68dfc3',
            '#a7c6b7',
          ],
          'circle-opacity': 0.9,
          'circle-stroke-color': '#061310',
          'circle-stroke-width': 1,
        },
      })
      map.addLayer({
        id: 'waypoint-labels',
        type: 'symbol',
        source: WAYPOINT_SOURCE,
        minzoom: 5,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 8.5, 8, 10, 12, 11.5],
          'text-letter-spacing': 0.14,
          'text-offset': [0, -1.25],
          'text-anchor': 'bottom',
          'text-allow-overlap': false,
          'text-padding': 5,
        },
        paint: {
          'text-color': '#c3ded0',
          'text-halo-color': '#03100d',
          'text-halo-width': 1.8,
          'text-opacity': 0.9,
        },
      })

      // Live AIS hulls: real positions from the open Digitraffic feed. Kept as a
      // separate GeoJSON layer (not DOM markers) so a few hundred hulls stay cheap.
      map.addLayer({
        id: LIVE_AIS_LAYER,
        type: 'circle',
        source: LIVE_AIS_SOURCE,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2, 8, 4, 12, 6.5],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.9,
          'circle-stroke-color': '#03100c',
          'circle-stroke-width': 0.6,
        },
      })

      map.addLayer({
        id: 'anchorage-labels',
        type: 'symbol',
        source: ANCHORAGE_SOURCE,
        minzoom: 5,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 6, 9, 7.5, 12, 9],
          'text-letter-spacing': 0.12,
          'text-transform': 'uppercase',
          'text-max-width': 7,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#a8c7b7',
          'text-halo-color': '#04100d',
          'text-halo-width': 1.6,
          'text-opacity': 0.82,
        },
      })

      map.addLayer({
        id: 'blockade-fill',
        type: 'fill',
        source: BLOCKADE_SOURCE,
        layout: { visibility: 'none' },
        paint: {
          'fill-color': '#ff6548',
          'fill-opacity': 0.1,
        },
      })
      map.addLayer({
        id: 'blockade-line',
        type: 'line',
        source: BLOCKADE_SOURCE,
        layout: { visibility: 'none' },
        paint: {
          'line-color': '#ff8064',
          'line-opacity': 0.85,
          'line-width': 1.4,
          'line-dasharray': [3, 3],
        },
      })

      map.addLayer({
        id: 'recon-queue',
        type: 'circle',
        source: RECON_QUEUE_SOURCE,
        layout: { visibility: 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 1.4, 9, 3.2, 13, 5.5],
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'dwell'],
            6,
            '#d8b86e',
            28,
            '#ff9c6c',
            50,
            '#ff6548',
          ],
          'circle-opacity': 0.82,
          'circle-blur': 0.18,
          'circle-stroke-color': 'rgba(255, 214, 171, 0.24)',
          'circle-stroke-width': 0.5,
        },
      })

      const blockadeElement = document.createElement('div')
      blockadeElement.className = 'blockade-marker'
      blockadeElement.innerHTML = `
        <span class="blockade-ring"></span>
        <span class="blockade-hull"><i></i><b></b></span>
        <span class="blockade-label"><strong>EVER GIVEN</strong><em>AGROUND · KM 151</em></span>
      `
      blockadeMarkerRef.current = new Marker({
        element: blockadeElement,
        anchor: 'center',
      })
        .setLngLat(everGiven.location)
        .addTo(map)
      blockadeHullRef.current = blockadeElement.querySelector<HTMLElement>('.blockade-hull')

      initialSyncSources(initialChokepoint)
      initialRebuildMarkers(initialChokepoint)

      requestAnimationFrame(() => {
        fitChart(map, initialChokepoint)
      })
    })

    let lastFrame = 0
    let frame = 0
    const animate = (time: number) => {
      frame = requestAnimationFrame(animate)
      if (!map || !loadedRef.current || document.hidden) return
      if (time - lastFrame < 40) return
      lastFrame = time
      const route = routeRef.current
      for (const entry of movingRef.current) {
        const directionFactor = entry.direction === 'in' ? 1 : -1
        const progress =
          (((entry.baseProgress + directionFactor * time * entry.speed * 0.000035) % 1) + 1) % 1
        const point = pointAlong(route, progress)
        const pointAhead = pointAlong(route, clamp(progress + 0.006, 0, 1))
        const bearing = bearingBetween(point, pointAhead)
        entry.marker.setLngLat(point)
        if (entry.headingEl) {
          entry.headingEl.style.transform = `rotate(${directionFactor === 1 ? bearing : bearing + 180}deg)`
        }
      }

      const pulse = (time / 1000) % 5
      const blockade = blockadeHullRef.current
      if (blockade) {
        blockade.style.setProperty('--blockade-angle', `${22 + Math.sin(pulse) * 1.2}deg`)
      }
    }
    frame = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frame)
      vesselMarkers.forEach((marker) => marker.remove())
      arrowMarkers.forEach((marker) => marker.remove())
      blockadeMarkerRef.current?.remove()
      map.remove()
      mapRef.current = null
      loadedRef.current = false
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    syncSources(chokepoint)
    rebuildMarkers(chokepoint)
    if (mode === 'world') {
      fitWorld(map)
    } else {
      fitChart(map, chokepoint)
    }
  }, [chokepoint, mode, syncSources, rebuildMarkers])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const visible = (layer: string) => map.setLayoutProperty(layer, 'visibility', 'visible')
    const hidden = (layer: string) => map.setLayoutProperty(layer, 'visibility', 'none')

    if (mode === 'bathymetry') {
      hidden('heat-glow')
    } else if (mode === 'anchorages') {
      visible('heat-glow')
    } else if (mode === 'recon') {
      hidden('heat-glow')
      visible('blockade-fill')
      visible('blockade-line')
      visible('recon-queue')
    } else {
      hidden('heat-glow')
      hidden('blockade-fill')
      hidden('blockade-line')
      hidden('recon-queue')
    }

    // Seamarks stay on for every mode; in BATHY mode they are dimmed so the
    // depth band remains readable underneath the chart symbols.
    map.setPaintProperty(SEAMARK_LAYER, 'raster-opacity', mode === 'bathymetry' ? 0.55 : 0.86)

    const bathyOpacity =
      mode === 'bathymetry' ? 0.58 : mode === 'anchorages' ? 0.15 : mode === 'recon' ? 0.07 : 0.09
    const bathySaturation = mode === 'bathymetry' ? 0.34 : mode === 'anchorages' ? -0.02 : -0.2
    const bathyContrast = mode === 'bathymetry' ? 0.28 : 0.18
    const bathyBrightness = mode === 'bathymetry' ? 0.72 : 0.5

    // EMODnet only covers European seas, so it is used for Suez / Bosphorus and
    // GEBCO carries the other two gates. Rendering both at once would double up
    // the tint wherever their extents overlap.
    const activeBathy =
      chokepoint.bathySource === 'emodnet' ? 'bathymetry-raster' : 'bathymetry-global'
    const idleBathy =
      chokepoint.bathySource === 'emodnet' ? 'bathymetry-global' : 'bathymetry-raster'

    // GEBCO's raster encodes land elevation as near-white, which shows through
    // as a pink/magenta haze at low opacity. Keep it BATHY-only; EMODnet's sea
    // tint stays as a faint undertone in the other modes.
    const showBathy = chokepoint.bathySource === 'emodnet' || mode === 'bathymetry'
    if (showBathy) {
      visible(activeBathy)
    } else {
      hidden(activeBathy)
    }
    hidden(idleBathy)

    map.setPaintProperty(activeBathy, 'raster-opacity', bathyOpacity)
    map.setPaintProperty(activeBathy, 'raster-contrast', bathyContrast)
    if (chokepoint.bathySource === 'emodnet') {
      map.setPaintProperty(activeBathy, 'raster-saturation', bathySaturation)
      map.setPaintProperty(activeBathy, 'raster-brightness-max', bathyBrightness)
    } else {
      // GEBCO's global palette paints land elevation in saturated pink/purple,
      // which fights the nautical chart. Fully desaturate it so only relative
      // depth structure reads as neutral shading.
      map.setPaintProperty(activeBathy, 'raster-saturation', -1)
      map.setPaintProperty(
        activeBathy,
        'raster-brightness-max',
        mode === 'bathymetry' ? 0.44 : 0.4,
      )
      map.setPaintProperty(
        activeBathy,
        'raster-opacity',
        mode === 'bathymetry' ? 0.5 : bathyOpacity,
      )
    }

    if (mode !== 'recon') {
      hidden('blockade-fill')
      hidden('blockade-line')
      hidden('recon-queue')
    }

    map.setPaintProperty(
      'route-base',
      'line-color',
      mode === 'recon' ? '#ff8064' : mode === 'bathymetry' ? '#98f1de' : '#68dfc3',
    )
    map.setPaintProperty(
      'route-glow',
      'line-color',
      mode === 'recon' ? '#ff6548' : '#58e2c1',
    )
    map.setPaintProperty(
      'anchorage-fill',
      'fill-opacity',
      mode === 'anchorages' ? 0.1 : 0.035,
    )
    map.setPaintProperty(
      'waypoint-labels',
      'text-opacity',
      mode === 'bathymetry' ? 0.95 : 0.82,
    )

    containerRef.current?.setAttribute('data-mode', mode)
  }, [mode, chokepoint.bathySource])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    syncSources(chokepoint)
  }, [mode, reconProgress, chokepoint, syncSources])

  // World view draws one compact gate marker per chokepoint so the global chart
  // shows where the monitored waterways are, with their live pressure reading.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return

    gateMarkersRef.current.forEach((marker) => marker.remove())
    gateMarkersRef.current = []

    if (mode !== 'world') return

    for (const gate of chokepoints) {
      const element = document.createElement('button')
      element.type = 'button'
      element.className = `gate-marker gate-marker--${gate.tone}`
      element.innerHTML = `
        <span class="gate-marker__ring"></span>
        <span class="gate-marker__body">
          <strong>${gate.index}</strong>
          <em>${gate.nameZh}</em>
          <b>Q${gate.summary.queue}</b>
        </span>
      `
      element.addEventListener('click', (event) => {
        event.stopPropagation()
        gateClickRef.current?.(gate.id)
      })
      const marker = new Marker({ element, anchor: 'center' })
        .setLngLat(gate.center)
        .addTo(map)
      gateMarkersRef.current.push(marker)
    }
  }, [mode])

  useEffect(() => {
    liveVesselsRef.current = liveVessels ?? []
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const source = map.getSource(LIVE_AIS_SOURCE) as GeoJSONSource | undefined
    source?.setData(liveAisFeatures(liveVessels ?? []))
  }, [liveVessels])

  useEffect(() => {
    // Animated markers carry their own progress, so only the selected-state
    // classes change here; rebuilding them would restart every hull mid-route.
    markersRef.current.forEach((marker, id) => {
      marker.getElement().classList.toggle('is-selected', id === selectedId)
    })
  }, [selectedId])

  return (
    <div className={`map-canvas ${webglFailed ? 'is-unavailable' : ''}`} data-mode={mode}>
      <div className="chart-underlay" aria-hidden="true">
        <div className="underlay-grid" />
        <div className="underlay-rings">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="underlay-route" />
      </div>
      <div
        ref={containerRef}
        className="maplibre-host"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      {!chartReady && !webglFailed && (
        <div className="chart-loader" aria-hidden="true">
          <span className="chart-loader__ring" />
          <span className="chart-loader__label">ACQUIRING CHART</span>
          <em>ENC 3857 · 海图载入中</em>
        </div>
      )}
      {webglFailed && (
        <div className="webgl-fallback">
          <span>WEBGL2 UNAVAILABLE</span>
          <strong>CHART RENDERER OFFLINE</strong>
          <em>请启用浏览器硬件加速后重新载入海图</em>
        </div>
      )}
      <div className="map-grain" aria-hidden="true" />
      <div className="map-vignette" aria-hidden="true" />
    </div>
  )
})





