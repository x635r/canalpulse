import { useEffect, useState } from 'react'
import type { Chokepoint, WeatherSnapshot } from '../types'

type WeatherState = WeatherSnapshot & {
  weatherLabel: string
  chokepointId: string
}

type OpenMeteoCurrent = {
  temperature_2m?: number
  wind_speed_10m?: number
  wind_direction_10m?: number
  visibility?: number
  weather_code?: number
}

type MarineCurrent = {
  wave_height?: number
  wave_direction?: number
  wave_period?: number
}

function weatherLabel(code: number | undefined): string {
  if (code === undefined) return 'N/A'
  if (code === 0) return 'CLEAR'
  if (code <= 2) return 'PARTLY CLOUD'
  if (code === 3) return 'OVERCAST'
  if (code === 45 || code === 48) return 'FOG'
  if (code >= 51 && code <= 57) return 'DRIZZLE'
  if (code >= 61 && code <= 67) return 'RAIN'
  if (code >= 71 && code <= 77) return 'SNOW'
  if (code >= 80 && code <= 82) return 'SHOWERS'
  if (code >= 95) return 'THUNDER'
  return 'MIXED'
}

function fallbackFor(chokepoint: Chokepoint): WeatherState {
  return {
    windKnots: chokepoint.weatherFallback.windKnots,
    windDir: chokepoint.weatherFallback.windDir,
    waveM: chokepoint.weatherFallback.waveM,
    waveDir: null,
    wavePeriod: null,
    visibilityKm: chokepoint.weatherFallback.visibilityKm,
    airTempC: chokepoint.weatherFallback.airTempC,
    time: 'MODEL CACHE',
    status: 'fallback',
    weatherLabel: chokepoint.weatherFallback.weather,
    chokepointId: chokepoint.id,
  }
}

export function useWeather(chokepoint: Chokepoint): WeatherState {
  const [weatherState, setWeatherState] = useState<WeatherState>(() => fallbackFor(chokepoint))
  const weather =
    weatherState.chokepointId === chokepoint.id
      ? weatherState
      : fallbackFor(chokepoint)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    async function load() {
      const forecastParams = new URLSearchParams({
        latitude: String(chokepoint.weatherPoint[0]),
        longitude: String(chokepoint.weatherPoint[1]),
        current: 'temperature_2m,wind_speed_10m,wind_direction_10m,visibility,weather_code',
        timezone: 'GMT',
      })
      const marineParams = new URLSearchParams({
        latitude: String(chokepoint.marinePoint[0]),
        longitude: String(chokepoint.marinePoint[1]),
        current: 'wave_height,wave_direction,wave_period',
        timezone: 'GMT',
      })

      try {
        const [forecastResponse, marineResponse] = await Promise.all([
          fetch(`https://api.open-meteo.com/v1/forecast?${forecastParams}`, {
            signal: controller.signal,
          }),
          fetch(`https://marine-api.open-meteo.com/v1/marine?${marineParams}`, {
            signal: controller.signal,
          }).catch(() => null),
        ])
        if (!forecastResponse.ok) throw new Error('Weather request failed')

        const forecast = (await forecastResponse.json()) as {
          current?: OpenMeteoCurrent
        }
        let marine: { current?: MarineCurrent } | null = null
        if (marineResponse?.ok) {
          marine = (await marineResponse.json()) as { current?: MarineCurrent }
        }
        if (!active) return

        const current = forecast.current ?? {}
        setWeatherState({
          windKnots:
            current.wind_speed_10m !== undefined
              ? Number((current.wind_speed_10m * 0.539957).toFixed(1))
              : chokepoint.weatherFallback.windKnots,
          windDir: current.wind_direction_10m ?? chokepoint.weatherFallback.windDir,
          waveM: marine?.current?.wave_height ?? null,
          waveDir: marine?.current?.wave_direction ?? null,
          wavePeriod: marine?.current?.wave_period ?? null,
          visibilityKm:
            current.visibility !== undefined
              ? Number((current.visibility / 1000).toFixed(1))
              : chokepoint.weatherFallback.visibilityKm,
          airTempC: current.temperature_2m ?? chokepoint.weatherFallback.airTempC,
          time: new Date().toISOString().slice(11, 16),
          status: 'live',
          weatherLabel: weatherLabel(current.weather_code),
          chokepointId: chokepoint.id,
        })
      } catch {
        if (active) setWeatherState(fallbackFor(chokepoint))
      }
    }

    void load()
    const interval = window.setInterval(load, 15 * 60 * 1000)
    return () => {
      active = false
      controller.abort()
      window.clearInterval(interval)
    }
  }, [chokepoint])

  return weather
}
