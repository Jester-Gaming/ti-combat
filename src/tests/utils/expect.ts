// ============================================================================
// FACTORY FUNCTION
// ============================================================================

import type { DicePool } from '@/combat'

// ============================================================================
// CUSTOM MATCHERS
// ============================================================================

expect.extend({
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

interface CustomMatchers<R = unknown> {
  toContainDice(source: string, ...expected: [number, number][]): R
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion extends CustomMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
