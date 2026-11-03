import type { Chokepoint, ChokepointId, Vessel, VesselTypeId, VesselTypeMeta } from '../types'

export const vesselTypes: Record<VesselTypeId, VesselTypeMeta> = {
  container: {
    id: 'container',
    code: 'CT',
    label: 'Container',
    labelZh: '集装箱船',
    color: '#68dfc3',
    softColor: 'rgba(104, 223, 195, 0.16)',
    loa: 366,
    beam: 51,
    draft: 15.4,
    capacity: '14,800 TEU',
    description: 'Ultra-large container vessel',
  },
  bulk: {
    id: 'bulk',
    code: 'BK',
    label: 'Bulk',
    labelZh: '散货船',
    color: '#d8b86e',
    softColor: 'rgba(216, 184, 110, 0.16)',
    loa: 292,
    beam: 45,
    draft: 18.1,
    capacity: '180,000 DWT',
    description: 'Capesize dry bulk carrier',
  },
  lng: {
    id: 'lng',
    code: 'LG',
    label: 'LNG',
    labelZh: '液化气船',
    color: '#80b8ff',
    softColor: 'rgba(128, 184, 255, 0.16)',
    loa: 295,
    beam: 46,
    draft: 12.2,
    capacity: '174,000 m³',
    description: 'Membrane-type LNG carrier',
  },
  vlcc: {
    id: 'vlcc',
    code: 'VL',
    label: 'VLCC',
    labelZh: '超大型油轮',
    color: '#ff8368',
    softColor: 'rgba(255, 131, 104, 0.16)',
    loa: 333,
    beam: 60,
    draft: 21.5,
    capacity: '318,000 DWT',
    description: 'Very large crude carrier',
  },
}

export const vesselTypeList = Object.values(vesselTypes)

const names: Record<VesselTypeId, string[]> = {
  container: [
    'MSC AURELIA',
    'MAERSK HORIZON',
    'CMA CGM ORION',
    'EVER LUMINOUS',
    'COSCO PACIFIC',
    'HAPAG BERLIN EXPRESS',
    'ONE MERIDIAN',
    'HMM NEPTUNE',
    'YANG MING VIGOUR',
    'ZIM ATLAS',
    'MSC PALATINE',
    'OOCL SENTINEL',
    'EVER GOLDEN',
    'MAERSK SENTOSA',
    'CMA CGM LYRA',
    'COSCO HARMONY',
    'MSC TARANTO',
    'HAPAG ANTWERP',
    'ONE OLYMPUS',
    'EVER LIBRA',
    'YANG MING UNITY',
    'ZIM PACIFIC',
    'MSC CARPATHIA',
    'OOCL HORIZON',
  ],
  bulk: [
    'CAPE ANDROMEDA',
    'ORE TITAN',
    'NORDIC BARON',
    'PACIFIC GARNET',
    'SEA CORONA',
    'ATLANTIC HARVEST',
    'MINERAL CHINA',
    'BERGE NANTONG',
    'KSL SYDNEY',
    'HL MERCURY',
    'CAPE VICTORY',
    'STAR DANUBE',
    'NAVIOS AURORA',
    'TRUE COURAGE',
    'SEA HARMONY',
    'GOLDEN OCEAN',
    'IONIC ANAX',
    'CASTLE ISLAND',
    'OCEAN BULKER',
    'GLOBAL MERIDIAN',
  ],
  lng: [
    'LNG SAKURA',
    'METHANE SPIRIT',
    'Q-FLEX AL DAFNA',
    'GAS ARGENTINA',
    'LNG PIONEER',
    'AL GHUWARIYAH',
    'MARAN GAS',
    'HYUNDAI PRIDE',
    'CLEAN OCEAN',
    'LNG JUNO',
    'METHANE RIVER',
    'PACIFIC NOTOS',
    'GAS NEPTUNE',
    'LNG AQUARIUS',
    'GOLAR FROST',
    'METHANE LYDON',
    'LNG LAGOS',
    'FLEX COURAGEOUS',
  ],
  vlcc: [
    'SEA JADE',
    'FRONT ALTAIR',
    'NEW VISION',
    'EAGLE VENICE',
    'DHT LOTUS',
    'TI EUROPE',
    'UNIVERSAL WINNER',
    'DELTA POSEIDON',
    'ADVANTAGE SPRING',
    'NISSOS RHENIA',
    'MARAN ATHENA',
    'FRONT EAGLE',
    'SEA HORIZON',
    'IRON MAIDEN',
    'VLCC AURORA',
    'OCEAN CHALLENGER',
    'KHK VISION',
    'GENER8 KENSINGTON',
    'SAMSUNG HOPE',
    'NEW HARMONY',
    'TITAN ASIA',
    'PACIFIC VOYAGER',
  ],
}

const flags = ['PA', 'LR', 'MH', 'SG', 'MT', 'BS', 'HK', 'GR', 'DK', 'NO', 'CN', 'JP', 'CY', 'IT']

const destinations: Record<ChokepointId, { in: string[]; out: string[] }> = {
  suez: {
    in: ['ROTTERDAM', 'PIRAEUS', 'ALGECIRAS', 'GENOA', 'JEDDAH'],
    out: ['SINGAPORE', 'JEBEL ALI', 'SHANGHAI', 'FUJAIRAH', 'MUMBAI'],
  },
  panama: {
    in: ['BALBOA', 'CALLAO', 'VALPARAISO', 'BUENAVENTURA', 'GUAYAQUIL'],
    out: ['CRISTOBAL', 'HOUSTON', 'NEW YORK', 'CARTAGENA', 'ROTTERDAM'],
  },
  malacca: {
    in: ['SINGAPORE', 'PORT KLANG', 'TANJUNG PELEPAS', 'PASIR GUDANG', 'LAEM CHABANG'],
    out: ['COLOMBO', 'JEBEL ALI', 'SUEZ', 'FUJAIRAH', 'MUMBAI'],
  },
  bosphorus: {
    in: ['ISTANBUL', 'GEMLIK', 'IZMIR', 'ALIAGA', 'CONSTANTA'],
    out: ['NOVOROSSIYSK', 'ODESSA', 'BURGAS', 'BATUMI', 'CONSTANTA'],
  },
  hormuz: {
    in: ['JEBEL ALI', 'FUJAIRAH', 'RAS TANURA', 'KHOR FAKKAN', 'MUSCAT'],
    out: ['NINGBO', 'SINGAPORE', 'MUMBAI', 'COLOMBO', 'YOKOHAMA'],
  },
  gibraltar: {
    in: ['ALGECIRAS', 'TANGIER MED', 'VALENCIA', 'BARCELONA', 'CASABLANCA'],
    out: ['ROTTERDAM', 'HAMBURG', 'LONDON', 'LE HAVRE', 'NEW YORK'],
  },
  'bab-el-mandeb': {
    in: ['JEDDAH', 'SUEZ', 'PORT SUDAN', 'DJIBOUTI', 'ADEN'],
    out: ['MOMBASA', 'DURBAN', 'COLOMBO', 'SINGAPORE', 'MUMBAI'],
  },
  dover: {
    in: ['ROTTERDAM', 'ANTWERP', 'HAMBURG', 'LE HAVRE', 'ZEEBRUGGE'],
    out: ['LONDON', 'SOUTHAMPTON', 'LIVERPOOL', 'DUBLIN', 'FELIXSTOWE'],
  },
}

const origins: Record<ChokepointId, string[]> = {
  suez: ['JEDDAH', 'PIRAEUS', 'FUJAIRAH', 'COLOMBO', 'JEBEL ALI'],
  panama: ['SHANGHAI', 'BUSAN', 'MANZANILLO', 'CALLAO', 'HOUSTON'],
  malacca: ['SINGAPORE', 'COLOMBO', 'JEBEL ALI', 'SHANGHAI', 'ROTTERDAM'],
  bosphorus: ['NOVOROSSIYSK', 'CONSTANTA', 'GEMLIK', 'PIRAEUS', 'ODESSA'],
  hormuz: ['JEBEL ALI', 'FUJAIRAH', 'SINGAPORE', 'COLOMBO', 'MUMBAI'],
  gibraltar: ['ALGECIRAS', 'ROTTERDAM', 'CASABLANCA', 'VALENCIA', 'HAMBURG'],
  'bab-el-mandeb': ['JEDDAH', 'DJIBOUTI', 'ADEN', 'MOMBASA', 'COLOMBO'],
  dover: ['ROTTERDAM', 'DOVER', 'ANTWERP', 'LE HAVRE', 'SOUTHAMPTON'],
}

const draftBias: Record<VesselTypeId, number> = {
  container: 0.95,
  bulk: 1,
  lng: 0.96,
  vlcc: 0.985,
}

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pick<T>(list: T[], random: () => number) {
  return list[Math.floor(random() * list.length)]
}

function jitterAround(
  center: [number, number],
  radiusKm: number,
  random: () => number,
): [number, number] {
  const angle = random() * Math.PI * 2
  const radius = Math.sqrt(random()) * radiusKm
  const lat = center[1] + (radius * Math.sin(angle)) / 111
  const lng = center[0] + (radius * Math.cos(angle)) / (111 * Math.cos((center[1] * Math.PI) / 180))
  return [Number(lng.toFixed(5)), Number(lat.toFixed(5))]
}

function queueBuckets(random: () => number, type: VesselTypeId, chokepoint: Chokepoint) {
  const vessel = vesselTypes[type]
  const maximum = Math.min(vessel.draft, chokepoint.depth.authorizedDraft - 0.1)
  return Number((maximum * draftBias[type] - random() * 0.75).toFixed(1))
}

export function generateFleet(chokepoint: Chokepoint): Vessel[] {
  const random = mulberry32(hashSeed(chokepoint.id))
  const queueVessels: Vessel[] = []
  const usedNames: Record<VesselTypeId, number> = {
    container: 0,
    bulk: 0,
    lng: 0,
    vlcc: 0,
  }

  ;(Object.keys(chokepoint.queueMatrix) as VesselTypeId[]).forEach((type) => {
    const bucketCounts = chokepoint.queueMatrix[type]
    const bucketDefinitions = [
      [1, 5.8],
      [6.1, 11.8],
      [12.2, 23.5],
      [25.0, 50.0],
    ]

    bucketCounts.forEach((count, bucketIndex) => {
      for (let index = 0; index < count; index += 1) {
        const anchorages = chokepoint.anchorages
        const totalWeight = anchorages.reduce((sum, anchorage) => sum + anchorage.weight, 0)
        let needle = random() * totalWeight
        let anchorage = anchorages[0]
        for (const candidate of anchorages) {
          needle -= candidate.weight
          if (needle <= 0) {
            anchorage = candidate
            break
          }
        }
        const meta = vesselTypes[type]
        const nameIndex = usedNames[type] % names[type].length
        usedNames[type] += 1
        const waitMin = bucketDefinitions[bucketIndex][0]
        const waitMax = bucketDefinitions[bucketIndex][1]
        const waitHours = Number((waitMin + random() * (waitMax - waitMin)).toFixed(1))
        const coordinate = jitterAround(anchorage.coord, anchorage.radiusKm, random)
        const serial = String(240000 + Math.floor(random() * 590000))
        const flag = pick(flags, random)

        queueVessels.push({
          id: `${chokepoint.id}-q-${queueVessels.length + 1}`,
          mmsi: `6360${serial}`.slice(0, 9),
          imo: `9${String(400000 + Math.floor(random() * 500000))}`,
          name: names[type][nameIndex],
          type,
          flag,
          loa: Number((meta.loa - random() * 18).toFixed(1)),
          beam: Number((meta.beam - random() * 2.5).toFixed(1)),
          draft: queueBuckets(random, type, chokepoint),
          dwt: meta.capacity,
          speed: 0,
          destination: pick(destinations[chokepoint.id].in, random),
          origin: pick(origins[chokepoint.id], random),
          status: 'anchored',
          waitHours,
          eta: `${Math.floor(waitHours)}H ${String(Math.floor((waitHours % 1) * 60)).padStart(2, '0')}M`,
          anchorageId: anchorage.id,
          heading: Math.floor(anchorages.indexOf(anchorage) === 0 ? 160 + random() * 60 : 330 + random() * 40),
          progress: 0,
          direction: random() > 0.5 ? 'in' : 'out',
          initialWait: waitHours,
          position: coordinate,
        })
      }
    })
  })

  const movingCount = chokepoint.id === 'malacca' ? 15 : 11
  const movingVessels: Vessel[] = []
  for (let index = 0; index < movingCount; index += 1) {
    const type = (['container', 'bulk', 'lng', 'vlcc'] as VesselTypeId[])[index % 4]
    const meta = vesselTypes[type]
    const direction: 'in' | 'out' = index % 2 === 0 ? 'in' : 'out'
    const flag = pick(flags, random)
    const serial = String(320000 + Math.floor(random() * 500000))

    movingVessels.push({
      id: `${chokepoint.id}-m-${index + 1}`,
      mmsi: `5380${serial}`.slice(0, 9),
      imo: `9${String(500000 + Math.floor(random() * 400000))}`,
      name: names[type][(index + 4) % names[type].length],
      type,
      flag,
      loa: Number((meta.loa - random() * 14).toFixed(1)),
      beam: Number((meta.beam - random() * 1.8).toFixed(1)),
      draft: queueBuckets(random, type, chokepoint),
      dwt: meta.capacity,
      speed: Number((7.2 + random() * 3.8).toFixed(1)),
      destination: pick(destinations[chokepoint.id][direction === 'in' ? 'in' : 'out'], random),
      origin: pick(origins[chokepoint.id], random),
      status: index % 5 === 0 ? 'transit' : 'underway',
      waitHours: 0,
      eta: `${String(2 + Math.floor(random() * 9)).padStart(2, '0')}H ${String(Math.floor(random() * 60)).padStart(2, '0')}M`,
      heading: Math.floor(random() * 360),
      progress: Number((0.12 + random() * 0.76).toFixed(3)),
      direction,
      initialWait: 0,
    })
  }

  return [...queueVessels, ...movingVessels]
}

const leadTypeByChokepoint: Record<ChokepointId, VesselTypeId> = {
  suez: 'vlcc',
  panama: 'container',
  malacca: 'bulk',
  bosphorus: 'lng',
  hormuz: 'vlcc',
  gibraltar: 'container',
  'bab-el-mandeb': 'vlcc',
  dover: 'container',
}

export function getLeadVessel(fleet: Vessel[]): Vessel {
  const chokepoint = fleet[0]?.id.split('-')[0] as ChokepointId | undefined
  const preferredType = chokepoint ? leadTypeByChokepoint[chokepoint] : 'container'
  return (
    fleet.find((vessel) => vessel.type === preferredType && vessel.status === 'anchored') ??
    fleet.find((vessel) => vessel.status === 'anchored') ??
    fleet[0]
  )
}

export function heatmapTotal(chokepoint: Chokepoint) {
  return (Object.keys(chokepoint.queueMatrix) as VesselTypeId[]).reduce(
    (total, type) => total + chokepoint.queueMatrix[type].reduce((sum, value) => sum + value, 0),
    0,
  )
}
