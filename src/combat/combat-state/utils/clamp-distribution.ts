import type { DiceRollOutcome } from './get-dice-distribution'

/**
 * Clamp a hit-outcome distribution at `cap`. Outcomes with `hits > cap`
 * have their probability folded into the `hits === cap` entry.
 *
 * Returns the input reference unchanged when no clamping is needed
 * (i.e. `dist.length <= cap + 1`). Never mutates `dist`.
 *
 * Lossless when applied to a setting where outcomes past `cap` would
 * collapse to the cap state anyway (e.g. AFB hits beyond the
 * participating-fighter count).
 */
export function clampDistribution(
  dist: DiceRollOutcome[],
  cap: number,
): DiceRollOutcome[] {
  if (dist.length <= cap + 1) return dist
  const out = dist.slice(0, cap + 1)
  let tail = 0
  for (let i = cap + 1; i < dist.length; i++) tail += dist[i].probability
  out[cap] = {
    hits: cap,
    probability: out[cap].probability + tail,
  }
  return out
}
