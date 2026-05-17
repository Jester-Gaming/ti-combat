// ============================================================================
// FACTORY FUNCTION
// ============================================================================

import type { DicePool, StateWithProbability } from '@/combat'

// ============================================================================
// CUSTOM MATCHERS
// ============================================================================

const BRANCH_PROBABILITY_TOLERANCE = 1e-9

export interface BranchSpec<X> {
  value: X
  predicate?: (branch: StateWithProbability) => boolean
  probability: number
}

function valueEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!valueEquals(a[i], b[i])) return false
    }
    return true
  }
  return false
}

expect.extend({
  toHaveBranches<X>(
    received: StateWithProbability[],
    extractor: (branch: StateWithProbability) => X,
    specs: BranchSpec<X>[],
  ) {
    const failures: string[] = []
    specs.forEach((spec, idx) => {
      const matching = received.filter(
        b =>
          valueEquals(extractor(b), spec.value) &&
          (spec.predicate?.(b) ?? true),
      )
      const total = matching.reduce((s, b) => s + b.probability, 0)
      if (Math.abs(total - spec.probability) > BRANCH_PROBABILITY_TOLERANCE) {
        failures.push(
          `  [${idx}] value=${JSON.stringify(spec.value)}: expected probability ${spec.probability}, got ${total} (matched ${matching.length}/${received.length})`,
        )
      }
    })
    const pass = failures.length === 0
    return {
      pass,
      message: () =>
        pass
          ? `expected branches not to match all specs`
          : `expected branches to match specs:\n${failures.join('\n')}`,
    }
  },

  toContainDice(
    received: DicePool,
    source: string,
    ...expected: [number, number][]
  ) {
    const dice = received[source] ?? []
    const values = dice.map(d => `[${d[0]}, ${d[1]}]`).join(', ')

    if (expected.length === 0) {
      const pass = dice.length > 0
      return {
        pass,
        message: () =>
          pass
            ? `expected no ${source} dice but found [${values}]`
            : `expected ${source} dice but found none`,
      }
    }

    const remaining = [...dice]
    const missing: [number, number][] = []
    for (const exp of expected) {
      const idx = remaining.findIndex(d => d[0] === exp[0] && d[1] === exp[1])
      if (idx >= 0) {
        remaining.splice(idx, 1)
      } else {
        missing.push(exp)
      }
    }

    const pass = missing.length === 0
    return {
      pass,
      message: () =>
        pass
          ? `expected ${source} dice [${values}] not to contain ${expected.map(e => `[${e}]`).join(', ')}`
          : `expected ${source} dice [${values}] to contain ${missing.map(e => `[${e}]`).join(', ')}`,
    }
  },
})
