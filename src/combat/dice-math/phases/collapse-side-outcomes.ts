/**
 * Tail-trim a per-side outcome list. Outcomes grouped by `totalHits(o)`
 * whose marginal probability is below `threshold` at either extreme are
 * merged into the next outcome inward — their mass is distributed
 * proportionally across the outcomes at the adjacent surviving total.
 *
 * The bucket / per-source structure of surviving outcomes is unchanged;
 * only their probabilities scale up to absorb collapsed tails. Total
 * probability is preserved.
 *
 * Iterates inward from both extremes until the remaining min/max
 * marginals meet the threshold or only one distinct total remains. The
 * input array and its elements are not mutated — surviving clones
 * carry adjusted `probability` values.
 */
export function collapseSideOutcomes<T extends { probability: number }>(
  outcomes: readonly T[],
  totalHits: (o: T) => number,
  threshold: number,
): T[] {
  if (threshold <= 0) return [...outcomes]
  if (outcomes.length <= 1) return [...outcomes]

  const clones = outcomes.map(o => ({ ...o }))

  const byTotal = new Map<number, T[]>()
  for (const o of clones) {
    const t = totalHits(o)
    const bucket = byTotal.get(t)
    if (bucket) bucket.push(o)
    else byTotal.set(t, [o])
  }

  const totals = Array.from(byTotal.keys()).sort((a, b) => a - b)
  if (totals.length <= 1) return clones

  function marginalAt(total: number): number {
    let sum = 0
    for (const o of byTotal.get(total)!) sum += o.probability
    return sum
  }

  function mergeInto(srcTotal: number, dstTotal: number): void {
    const srcMass = marginalAt(srcTotal)
    const dstOutcomes = byTotal.get(dstTotal)!
    const dstMass = marginalAt(dstTotal)
    if (dstMass > 0) {
      for (const o of dstOutcomes) {
        o.probability += srcMass * (o.probability / dstMass)
      }
    } else {
      // Defensive: kernel skips p === 0 branches earlier so dstMass > 0
      // normally. If it isn't, dump everything into the first outcome.
      dstOutcomes[0].probability += srcMass
    }
    byTotal.delete(srcTotal)
  }

  let lo = 0
  while (lo < totals.length - 1) {
    const t = totals[lo]
    if (marginalAt(t) >= threshold) break
    mergeInto(t, totals[lo + 1])
    lo++
  }

  let hi = totals.length - 1
  while (hi > lo) {
    const t = totals[hi]
    if (marginalAt(t) >= threshold) break
    mergeInto(t, totals[hi - 1])
    hi--
  }

  const out: T[] = []
  for (const t of totals) {
    const bucket = byTotal.get(t)
    if (bucket) out.push(...bucket)
  }
  return out
}
