import type { HitsDist, RerollSide } from '../reroll-strategy'
import type { FlatSource, RerollTargetSpec, Source } from '../types'
import { binomial, hitProb } from '../utils/get-dice-distribution'

/** Per-source hits map carried through reroll passes. Sources missing from
 *  the record produced no dice. */
export type PerSourceHits = Record<Source, number>

/** Total hits across all sources in a per-source hits map. */
function totalHits(hits: PerSourceHits): number {
  let t = 0
  for (const s of Object.keys(hits)) t += hits[s]
  return t
}

/** Marginal `(hits, probability)` distribution over total hits, summed
 *  across a list of branches. Branches must carry a `hits` map and
 *  `probability`. */
function marginalize<B extends { hits: PerSourceHits; probability: number }>(
  branches: readonly B[],
): HitsDist {
  const totals = new Map<number, number>()
  for (const b of branches) {
    const t = totalHits(b.hits)
    totals.set(t, (totals.get(t) ?? 0) + b.probability)
  }
  return Array.from(totals.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hits, probability]) => ({ hits, probability }))
}

/** Evaluate a REROLL spec's `rerollIf` gate against a side total +
 *  pre-reroll marginal. No predicate ⇒ always fires. */
function fires(
  rerollIf: ((side: RerollSide) => boolean) | undefined,
  total: number,
  distribution: HitsDist,
): boolean {
  if (!rerollIf) return true
  return rerollIf({ total, distribution })
}

/** Apply REROLL `target` semantics to a `PerSourceHits` map, returning
 *  every post-reroll outcome with its multiplicative probability factor.
 *  Per-source rerolls are independent, so the outcomes form the cross
 *  product of per-source rerolled PMFs.
 *
 *  - `'ALL'`   — every die rerolled with a fresh face; keptHits = 0.
 *  - `'MISSES'`— only miss dice (`N - k`) are rerolled; the original `k`
 *                hits stay. */
function rerollHits(
  hits: PerSourceHits,
  sourceMap: Record<Source, FlatSource>,
  target: 'MISSES' | 'ALL',
): { hits: PerSourceHits; factor: number }[] {
  let perm: { hits: PerSourceHits; factor: number }[] = [
    { hits: {}, factor: 1 },
  ]
  for (const source of Object.keys(hits)) {
    const info = sourceMap[source]
    const k = hits[source]
    const totalDice = info.unitCount * info.dicePerUnit
    const p = hitProb(info.hitValue)
    const rerolledCount = target === 'ALL' ? totalDice : totalDice - k
    const keptHits = target === 'ALL' ? 0 : k
    const pmf = binomial(rerolledCount, p)
    const next: { hits: PerSourceHits; factor: number }[] = []
    for (const cur of perm) {
      for (let m = 0; m < pmf.length; m++) {
        const w = pmf[m]
        if (w === 0) continue
        next.push({
          hits: { ...cur.hits, [source]: keptHits + m },
          factor: cur.factor * w,
        })
      }
    }
    perm = next
  }
  return perm
}

/** Apply a sequence of REROLL specs to per-source branches. Each branch
 *  carries arbitrary `Meta` (preserved across rerolls) plus `hits` and
 *  `probability`. The factory recombines a rerolled outcome with the
 *  source branch's metadata. */
export function applyRerollSpecs<
  Meta,
  B extends { hits: PerSourceHits; probability: number } & Meta,
>(
  branches: B[],
  sourceMap: Record<Source, FlatSource>,
  specs: readonly RerollTargetSpec[],
  factory: (base: B, hits: PerSourceHits, probability: number) => B,
): B[] {
  let out = branches
  for (const spec of specs) {
    const distribution = marginalize(out)
    const next: B[] = []
    for (const branch of out) {
      const total = totalHits(branch.hits)
      if (!fires(spec.rerollIf, total, distribution)) {
        next.push(branch)
        continue
      }
      for (const r of rerollHits(branch.hits, sourceMap, spec.target)) {
        next.push(factory(branch, r.hits, branch.probability * r.factor))
      }
    }
    out = next
  }
  return out
}
