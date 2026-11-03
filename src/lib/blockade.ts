import { everGiven } from '../data/blockade'
import { clamp } from './geo'

const REPLAY_WINDOW_HOURS = 292
const GROUNDING_MS = Date.UTC(2021, 2, 23, 7, 40)
const CLOSURE_END = everGiven.maxDurationHours / REPLAY_WINDOW_HOURS
const REOPENING_END = 155.33 / REPLAY_WINDOW_HOURS
const CLEARING_START = 164 / REPLAY_WINDOW_HOURS

export function getReconState(progress: number) {
  const safeProgress = clamp(progress, 0, 1)
  const points = everGiven.backlog
  const value = safeProgress * (points.length - 1)
  const lower = Math.floor(value)
  const upper = Math.min(points.length - 1, Math.ceil(value))
  const fraction = value - lower
  const queue = Math.round(points[lower].queue + (points[upper].queue - points[lower].queue) * fraction)
  const elapsedHours = safeProgress * REPLAY_WINDOW_HOURS
  const stamp = new Date(GROUNDING_MS + elapsedHours * 3_600_000)
  const dayLabel = stamp
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
    .toUpperCase()
  const currentEvent =
    [...everGiven.events].reverse().find((event) => event.at <= safeProgress) ?? everGiven.events[0]
  const cost = Math.round(Math.min(elapsedHours, everGiven.maxDurationHours)) * everGiven.costPerHour
  const throughput = points[Math.round(value)].throughput

  return {
    queue,
    elapsedHours,
    dayLabel,
    event: currentEvent,
    cost,
    throughput,
    phase:
      safeProgress < CLOSURE_END
        ? 'CLOSED'
        : safeProgress < REOPENING_END
          ? 'SALVAGE'
          : safeProgress < CLEARING_START
            ? 'REOPENING'
            : 'CLEARING',
  }
}
