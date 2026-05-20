import type { UIConfigItem } from '@/combat/abilities-engine/types'

/** A user-configurable strategy controlling whether a reroll fires for a
 *  given side's roll outcome. Strategies operate on aggregate hit counts
 *  for the side. */
export type RerollStrategy =
  | { kind: 'NEVER' }
  | { kind: 'ALWAYS' }
  | { kind: 'IF_HITS_AMOUNT_LE'; threshold: number }
  | { kind: 'IF_HITS_AMOUNT_GE'; threshold: number }
  | { kind: 'IF_HITS_PERCENT_LE'; threshold: number }
  | { kind: 'IF_HITS_PERCENT_GE'; threshold: number }

/** A `(hits, probability)` distribution over total hits for a side. */
export type HitsDist = readonly { hits: number; probability: number }[]

/** Aggregate snapshot of a side's pre-reroll roll, supplied to
 *  `rerollIf` / `consumeUseIf` predicates. */
export interface RerollSide {
  /** Total hits this side rolled in the current outcome. */
  total: number
  /** Pre-reroll marginal hit distribution for the side. */
  distribution: HitsDist
}

const KIND_ITEMS = [
  { label: 'Never', value: 'NEVER' },
  { label: 'Always', value: 'ALWAYS' },
  { label: 'If hits ≤ N', value: 'IF_HITS_AMOUNT_LE' },
  { label: 'If hits ≥ N', value: 'IF_HITS_AMOUNT_GE' },
  { label: 'If worse than N%', value: 'IF_HITS_PERCENT_LE' },
  { label: 'If better than N%', value: 'IF_HITS_PERCENT_GE' },
]

/** Builds the UI controls for picking a `RerollStrategy` from two params:
 *  one `select` for the kind and (conditionally) one `number` for the
 *  threshold. */
export function rerollStrategyConfig<TParams = Record<string, unknown>>(
  kindKey: keyof TParams,
  thresholdKey: keyof TParams,
  kindValue: RerollStrategy['kind'],
  label?: string,
): UIConfigItem<TParams>[] {
  const items: UIConfigItem<TParams>[] = [
    { type: 'select', key: kindKey, label, items: KIND_ITEMS },
  ]
  if (kindValue !== 'NEVER' && kindValue !== 'ALWAYS') {
    items.push({
      type: 'number',
      key: thresholdKey,
      label: 'Threshold',
      min: 0,
    })
  }
  return items
}

/** Combine the UI's kind + threshold params into a single `RerollStrategy`. */
export function buildRerollStrategy(
  kind: RerollStrategy['kind'],
  threshold: number,
): RerollStrategy {
  if (kind === 'NEVER' || kind === 'ALWAYS') return { kind }
  return { kind, threshold }
}

/** Mean (midpoint) percentile rank of `side.total` within its distribution,
 *  measured from the given end: the probability mass strictly beyond `total`
 *  plus half the mass tied at `total`.
 *
 *  Splitting the tied mass is what makes coarse distributions behave: with a
 *  single die (P(miss)=0.6, P(hit)=0.4) a plain CDF puts the worst possible
 *  roll (a miss) at rank 0.6 — above the bottom 50% — so "worse than 50%"
 *  wouldn't reroll it. The midpoint rank puts the miss at 0.30 (and the hit at
 *  0.80), matching the intuition that a below-mean roll is "worse than 50%".
 *  A degenerate single-outcome distribution ranks at exactly 0.5 from both
 *  ends, so the strict `< cutoff` comparison never fires on a no-dice side. */
function midpointRank(side: RerollSide, from: 'bottom' | 'top'): number {
  let beyond = 0
  let at = 0
  for (const o of side.distribution) {
    if (o.hits === side.total) at += o.probability
    else if (from === 'bottom' ? o.hits < side.total : o.hits > side.total)
      beyond += o.probability
  }
  return beyond + at / 2
}

/** Converts a `RerollStrategy` into a predicate matching `RerollDecl.rerollIf`. */
export function strategyToPredicate(
  strategy: RerollStrategy,
): (side: RerollSide) => boolean {
  switch (strategy.kind) {
    case 'NEVER':
      return () => false
    case 'ALWAYS':
      return () => true
    case 'IF_HITS_AMOUNT_LE':
      return side => side.total <= strategy.threshold
    case 'IF_HITS_AMOUNT_GE':
      return side => side.total >= strategy.threshold
    case 'IF_HITS_PERCENT_LE': {
      const cutoff = strategy.threshold / 100
      return side => midpointRank(side, 'bottom') < cutoff
    }
    case 'IF_HITS_PERCENT_GE': {
      const cutoff = strategy.threshold / 100
      return side => midpointRank(side, 'top') < cutoff
    }
  }
}
