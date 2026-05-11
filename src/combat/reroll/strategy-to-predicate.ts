import type { RerollSide, RerollStrategy } from './types'

export type RerollPerspective = 'own' | 'opponent'

export function strategyToPredicate(
  strategy: RerollStrategy,
  perspective: RerollPerspective,
): (side: RerollSide) => boolean {
  switch (strategy.kind) {
    case 'NEVER':
      return () => false
    case 'ALWAYS':
      return () => true
    case 'IF_HITS_LE':
      return side => side.total <= strategy.threshold
    case 'IF_HITS_GE':
      return side => side.total >= strategy.threshold
    case 'IF_BAD_OUTCOME': {
      const cutoff = strategy.pct / 100
      const cmp =
        perspective === 'own'
          ? (h: number, t: number) => h <= t
          : (h: number, t: number) => h >= t
      return side => {
        let mass = 0
        for (const o of side.distribution) {
          if (cmp(o.hits, side.total)) mass += o.probability
        }
        return mass <= cutoff + 1e-12
      }
    }
  }
}
