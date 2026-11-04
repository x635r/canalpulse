export type OceanLayerId =
  | 'sst'
  | 'sst-anomaly'
  | 'chlorophyll'
  | 'aerosol'
  | 'ice'
  | 'buoys'
  | 'quakes'

export interface OceanLayerDef {
  id: OceanLayerId
  label: string
  labelZh: string
  /** Group shown in the layer panel. */
  group: 'thermal' | 'bio' | 'hazard' | 'observation'
  /** Base WMS endpoint, without query string. */
  wms?: string
  /** WMS layer name. */
  wmsLayer?: string
  /** Days back from today to request; NASA GIBS needs an explicit DATE. */
  timeOffsetDays?: number
  attribution: string
  /** Approximate value range for the legend. */
  legend?: { min: number; max: number; unit: string; stops: string[] }
  note: string
}

/**
 * NASA GIBS serves global daily imagery as WMS in EPSG:3857 with CORS open,
 * which makes it usable directly as a MapLibre raster source.
 *
 * Values verified against live tiles: SST / SST-anomaly / chlorophyll / aerosol
 * return real pixels. Layers that were empty in testing are not listed.
 */
export const oceanLayers: OceanLayerDef[] = [
  {
    id: 'sst',
    label: 'Sea surface temperature',
    labelZh: '海表温度',
    group: 'thermal',
    wms: 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi',
    wmsLayer: 'GHRSST_L4_MUR_Sea_Surface_Temperature',
    timeOffsetDays: 3,
    attribution: 'SST © NASA GIBS / GHRSST MUR',
    legend: {
      min: -2,
      max: 34,
      unit: '°C',
      stops: ['#2b1a6b', '#1e5aa8', '#12a5b0', '#4fc36a', '#e3c84a', '#e07a35', '#b5342b'],
    },
    note: 'Multi-scale ultra-high resolution SST, daily composite.',
  },
  {
    id: 'sst-anomaly',
    label: 'SST anomaly',
    labelZh: '海温异常',
    group: 'thermal',
    wms: 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi',
    wmsLayer: 'GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies',
    timeOffsetDays: 3,
    attribution: 'SST anomaly © NASA GIBS / GHRSST MUR',
    legend: {
      min: -5,
      max: 5,
      unit: 'K',
      stops: ['#08306b', '#4292c6', '#d9d9d9', '#fd8d3c', '#a50f15'],
    },
    note: 'Departure from the 2003-2014 climatology. Useful for marine heatwaves.',
  },
  {
    id: 'chlorophyll',
    label: 'Chlorophyll-a',
    labelZh: '叶绿素浓度',
    group: 'bio',
    wms: 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi',
    wmsLayer: 'S3A_OLCI_Chlorophyll_a',
    timeOffsetDays: 4,
    attribution: 'Chlorophyll © NASA GIBS / Sentinel-3 OLCI',
    legend: {
      min: 0,
      max: 20,
      unit: 'mg/m³',
      stops: ['#46008b', '#0057a8', '#00a5a8', '#6cc24a', '#f2e53b'],
    },
    note: 'Phytoplankton biomass proxy; delineates upwelling and bloom zones.',
  },
  {
    id: 'aerosol',
    label: 'Aerosol optical depth',
    labelZh: '气溶胶光学厚度',
    group: 'bio',
    wms: 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi',
    wmsLayer: 'MODIS_Terra_Aerosol',
    timeOffsetDays: 3,
    attribution: 'Aerosol © NASA GIBS / MODIS Terra',
    legend: {
      min: 0,
      max: 3,
      unit: 'AOD',
      stops: ['#1a3a5c', '#2e8b9e', '#8fc94e', '#f3d34a', '#c1440e'],
    },
    note: 'Dust, smoke and haze — relevant to visibility at chokepoints.',
  },
  {
    id: 'buoys',
    label: 'NDBC buoys',
    labelZh: '海洋浮标',
    group: 'observation',
    attribution: 'Buoy observations © NOAA NDBC',
    note: 'Live wind, wave height, water temperature and pressure from ~830 moored buoys.',
  },
  {
    id: 'quakes',
    label: 'Seismic events',
    labelZh: '地震事件',
    group: 'hazard',
    attribution: 'Seismic events © USGS',
    note: 'M4.5+ events of the past 24h. Submarine quakes can trigger tsunami warnings.',
  },
]

export const oceanLayerById = Object.fromEntries(
  oceanLayers.map((layer) => [layer.id, layer]),
) as Record<OceanLayerId, OceanLayerDef>
