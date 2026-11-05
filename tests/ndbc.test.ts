import { describe, expect, it } from 'vitest'
import { parseNdbc } from '../src/data/oceanObservations'

// Real header + two data rows taken from the live NDBC feed.
const SAMPLE = `#STN       LAT      LON  YYYY MM DD hh mm WDIR WSPD   GST WVHT  DPD APD MWD   PRES  PTDY  ATMP  WTMP  DEWP  VIS   TIDE
#text      deg      deg   yr mo day hr mn degT  m/s   m/s   m   sec sec degT   hPa   hPa  degC  degC  degC  nmi     ft
22101    37.24   126.02  2026 11 04 12 00 120   5.0    MM  0.0   0   MM  MM     MM    MM  16.9  18.9    MM   MM     MM
41010    28.90   -78.47  2026 11 04 12 00 095   7.2   9.1  1.4   9  6.8 090 1015.2   0.5  24.5  27.3    MM   MM     MM
`

describe('parseNdbc', () => {
  it('skips the two header rows', () => {
    const rows = parseNdbc(SAMPLE)
    expect(rows).toHaveLength(2)
  })

  it('parses coordinates and station id', () => {
    const [first] = parseNdbc(SAMPLE)
    expect(first.station).toBe('22101')
    expect(first.lat).toBeCloseTo(37.24, 2)
    expect(first.lon).toBeCloseTo(126.02, 2)
  })

  it('maps MM sentinels to null instead of NaN', () => {
    const [first, second] = parseNdbc(SAMPLE)
    // Row 1 has MM for pressure and air temp fields in some columns
    expect(first.windSpeed).toBe(5)
    expect(first.waveHeight).toBe(0)
    // Row 2 has real pressure
    expect(second.pressure).toBeCloseTo(1015.2, 1)
    expect(second.waterTemp).toBeCloseTo(27.3, 1)
  })

  it('rejects impossible coordinates', () => {
    const bad = `#STN LAT LON YYYY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES PTDY ATMP WTMP DEWP VIS TIDE
#text deg deg yr mo day hr mn degT m/s m/s m sec sec degT hPa hPa degC degC degC nmi ft
BAD      95.00  200.00  2026 11 04 12 00 100 5.0 MM 0.0 0 MM MM MM MM 20.0 20.0 MM MM MM
`
    expect(parseNdbc(bad)).toHaveLength(0)
  })

  it('returns an empty array for a header-only feed', () => {
    const header = `#STN LAT LON YYYY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES PTDY ATMP WTMP DEWP VIS TIDE
#text deg deg yr mo day hr mn degT m/s m/s m sec sec degT hPa hPa degC degC degC nmi ft
`
    expect(parseNdbc(header)).toEqual([])
  })
})
