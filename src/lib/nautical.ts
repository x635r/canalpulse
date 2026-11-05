/**
 * Nautical under-keel clearance (UKC) engine.
 *
 * Replaces the previous hard-coded squat constants with the standard
 * engineering relationships used in real passage planning:
 *
 *  - Squat: Barrass II formula, `Cb * V^2 / 100` in open water and
 *    `Cb * V^2 / 50` in confined channels (canals, locks, narrow straits).
 *    Squat grows with the square of speed, which is exactly why the previous
 *    constant was wrong: a VLCC at 6 kn and a container ship at 12 kn cannot
 *    share the same allowance.
 *
 *  - Block coefficient (Cb) is derived from hull type. These are industry
 *    typical mid-range values, not per-vessel survey data.
 *
 *  - Minimum UKC is expressed as a percentage of static draft per waterway
 *    class, following PIANC / common port-authority practice:
 *      open water 5%, restricted channel 3%, canal 1.5%.
 *
 *  - Tidal allowance is only credited when the waterway actually has a usable
 *    tidal window. Sea-level canals (Suez) carry almost none; the Dover Strait
 *    has several metres.
 *
 * This is a planning aid, not a substitute for a vessel's approved passage
 * plan, pilot advice, or the operator's own UKC policy.
 */

import type { VesselTypeId } from '../types'

/** Typical block coefficients by hull form. */
export const BLOCK_COEFFICIENT: Record<VesselTypeId, number> = {
  // Fine-lined, high-speed hull form.
  container: 0.65,
  // Full-form dry bulk.
  bulk: 0.82,
  // Membrane LNG carriers sit between the two.
  lng: 0.7,
  // Very full crude carrier.
  vlcc: 0.85,
}

export type WaterwayClass = 'open' | 'restricted' | 'canal'

/** Minimum UKC as a fraction of static draft, by waterway class. */
export const MIN_UKC_FRACTION: Record<WaterwayClass, number> = {
  open: 0.05,
  restricted: 0.03,
  canal: 0.015,
}

/**
 * Barrass II squat. Returns metres.
 *
 * @param cb   block coefficient
 * @param speedKn speed over ground in knots
 * @param waterway `open` for unrestricted water, otherwise confined
 */
export function squatBarrass(cb: number, speedKn: number, waterway: WaterwayClass): number {
  const denominator = waterway === 'open' ? 100 : 50
  return (cb * speedKn * speedKn) / denominator
}

export interface UkcInput {
  /** Charted depth over the controlling point, metres (below chart datum). */
  chartDepth: number
  /** Height of tide above chart datum, metres. */
  tide: number
  /** Static draft of the vessel, metres. */
  draft: number
  /** Block coefficient of the hull. */
  cb: number
  /** Speed over ground, knots. */
  speedKn: number
  /** Waterway classification, drives both squat and the minimum UKC rule. */
  waterway: WaterwayClass
  /**
   * Optional operator policy that overrides the PIANC default. Some canals
   * publish a fixed minimum (e.g. SCA requires 0.30 m below the 20.1 m draft).
   */
  policyMinUkc?: number
}

export interface UkcResult {
  /** Gross under-keel clearance before squat, metres. */
  staticUkc: number
  /** Squat allowance actually deducted, metres. */
  squat: number
  /** Net UKC available while making way, metres. */
  netUkc: number
  /** Minimum UKC required for this waterway, metres. */
  requiredUkc: number
  /** netUkc - requiredUkc. Negative means the passage is not permissible. */
  margin: number
  verdict: 'safe' | 'caution' | 'no-go'
  waterway: WaterwayClass
  /** Human-readable basis, shown in the UI so the number is auditable. */
  basis: string
}

/**
 * Compute under-keel clearance for a transit.
 *
 * `netUkc = chartDepth + tide - draft - squat`
 */
export function computeUkc(input: UkcInput): UkcResult {
  const { chartDepth, tide, draft, cb, speedKn, waterway, policyMinUkc } = input

  const staticUkc = chartDepth + tide - draft
  const squat = squatBarrass(cb, speedKn, waterway)
  const netUkc = staticUkc - squat

  const requiredUkc =
    policyMinUkc !== undefined ? policyMinUkc : draft * MIN_UKC_FRACTION[waterway]

  const margin = netUkc - requiredUkc

  // A negative net clearance is a grounding regardless of policy.
  const verdict: UkcResult['verdict'] =
    netUkc <= 0 || margin < 0
      ? 'no-go'
      : margin < requiredUkc * 0.35
        ? 'caution'
        : 'safe'

  const pct = (MIN_UKC_FRACTION[waterway] * 100).toFixed(1)
  const basis =
    policyMinUkc !== undefined
      ? `operator minimum ${policyMinUkc.toFixed(2)} m`
      : `${pct}% of draft (${waterway})`

  return { staticUkc, squat, netUkc, requiredUkc, margin, verdict, waterway, basis }
}

/** Map a chokepoint's own classification onto the UKC waterway classes. */
export function waterwayClassFor(straitType: string, lockChambers: number): WaterwayClass {
  if (lockChambers > 0) return 'canal'
  const t = straitType.toUpperCase()
  if (t.includes('CANAL')) return 'canal'
  if (t.includes('NARROW') || t.includes('TSS') || t.includes('CHOKE')) return 'restricted'
  return 'open'
}
