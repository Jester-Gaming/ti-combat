import type { RerollSide, RerollStrategy } from './types'

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
      return side => {
        let mass = 0
        for (const o of side.distribution) {
          if (o.hits <= side.total) mass += o.probability
        }
        return mass <= cutoff + 1e-12
      }
    }
    case 'IF_HITS_PERCENT_GE': {
      const cutoff = strategy.threshold / 100
      return side => {
        let mass = 0
        for (const o of side.distribution) {
          if (o.hits >= side.total) mass += o.probability
        }
        return mass <= cutoff + 1e-12
      }
    }
  }
}
