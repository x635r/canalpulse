export type LngLat = [number, number]

export type ChokepointId =
  | 'suez'
  | 'panama'
  | 'malacca'
  | 'bosphorus'
  | 'hormuz'
  | 'gibraltar'
  | 'bab-el-mandeb'
  | 'dover'

export type VesselTypeId = 'container' | 'bulk' | 'lng' | 'vlcc'

export type MapMode = 'flow' | 'bathymetry' | 'anchorages' | 'recon' | 'world'

export type StatusTone = 'ok' | 'watch' | 'warn' | 'alert'

export interface VesselTypeMeta {
  id: VesselTypeId
  code: string
  label: string
  labelZh: string
  color: string
  softColor: string
  loa: number
  beam: number
  draft: number
  capacity: string
  description: string
}

export interface Anchorage {
  id: string
  name: string
  labelZh: string
  coord: LngLat
  radiusKm: number
  capacity: number
  utilization: number
  note: string
  weight: number
}

export interface Waypoint {
  name: string
  labelZh: string
  coord: LngLat
  kind: 'port' | 'lock' | 'waypoint' | 'shoal'
}

export interface DepthModel {
  chartDepth: number
  authorizedDraft: number
  minUkc: number
  tidalAllowance: number
  squat: number
  datum: string
  controllingPoint: string
  contours: number[]
  note: string
}

export interface Chokepoint {
  id: ChokepointId
  index: string
  name: string
  nameZh: string
  region: string
  straitType: string
  status: string
  statusZh: string
  tone: StatusTone
  center: LngLat
  zoom: number
  bearing: number
  route: LngLat[]
  waypoints: Waypoint[]
  anchorages: Anchorage[]
  queueMatrix: Record<VesselTypeId, [number, number, number, number]>
  summary: {
    active: number
    queue: number
    avgWaitHours: number
    maxWaitHours: number
    throughput: number
    transitHours: number
    changePct: number
    anchorageUtilization: number
    pressure: number
  }
  depth: DepthModel
  bathySource: 'emodnet' | 'gebco'
  weatherPoint: LngLat
  marinePoint: LngLat
  spark: number[]
  axis: {
    primary: string
    secondary: string
    primaryZh: string
    secondaryZh: string
  }
  channel: {
    lengthKm: number
    widthM: number
    lockChambers: number
    service: string
    operator: string
  }
  weatherFallback: {
    windKnots: number
    windDir: number
    waveM: number
    visibilityKm: number
    airTempC: number
    weather: string
  }
  bulletin: string
}

export interface Vessel {
  id: string
  mmsi: string
  imo: string
  name: string
  type: VesselTypeId
  flag: string
  loa: number
  beam: number
  draft: number
  dwt: string
  speed: number
  destination: string
  origin: string
  status: 'anchored' | 'underway' | 'transit'
  waitHours: number
  eta: string
  anchorageId?: string
  heading: number
  progress: number
  direction: 'in' | 'out'
  initialWait: number
  position?: LngLat
  /** True for vessels sourced from a live AIS feed rather than the sandbox fleet. */
  live?: boolean
}

export interface WeatherSnapshot {
  windKnots: number
  windDir: number
  waveM: number | null
  waveDir: number | null
  wavePeriod: number | null
  visibilityKm: number
  airTempC: number
  time: string
  status: 'live' | 'cached' | 'fallback'
}

export interface BacklogPoint {
  label: string
  day: number
  queue: number
  throughput: number
}

export interface BlockadeEvent {
  at: number
  date: string
  time: string
  title: string
  titleZh: string
  detail: string
  tone: 'neutral' | 'critical' | 'recovery' | 'open'
}

export interface BlockadeStory {
  id: string
  ship: string
  imo: string
  flag: string
  type: string
  loa: number
  beam: number
  draft: number
  capacity: string
  title: string
  titleZh: string
  location: LngLat
  blockCoord: LngLat
  startLabel: string
  durationLabel: string
  costPerHour: number
  tradeShare: number
  peakQueue: number
  maxDurationHours: number
  summary: string
  backlog: BacklogPoint[]
  events: BlockadeEvent[]
}
