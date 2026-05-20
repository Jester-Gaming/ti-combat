import type { CombatSide } from '@/types'

import type { DiceMathBranch } from '../branch-accumulator'
import type { HitsDist } from '../reroll-strategy'

/** Marginal `(hits, probability)` distribution over a landing side's main
 *  `.base` hits, summed across math-kernel branches. Custom sub-pool bases
 *  are excluded to match the reroll-strategy gating convention used by
 *  `run-dice-math`'s `markOneShotUses` (and War Funding). Zero-probability
 *  branches are skipped. Sorted ascending by hit count. */
export function marginalizeBaseHits(
  branches: readonly DiceMathBranch[],
  landing: CombatSide,
): HitsDist {
  const totals = new Map<number, number>()
  for (const b of branches) {
    if (b.probability === 0) continue
    const hits = b.pendingHitPool[landing].base
    totals.set(hits, (totals.get(hits) ?? 0) + b.probability)
  }
  return Array.from(totals.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hits, probability]) => ({ hits, probability }))
}
