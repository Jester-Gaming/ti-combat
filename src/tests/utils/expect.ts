// ============================================================================
// FACTORY FUNCTION
// ============================================================================

import type { UnitType } from '@/types'

import type { DicePool } from '../../combat/abilities/types'

// ============================================================================
// CUSTOM MATCHERS
// ============================================================================

expect.extend({
  toContainDice(
    received: DicePool,
    unitType: UnitType,
    expected: [number, number],
  ) {
    const dice = received[unitType] ?? []
    const pass = dice.some(d => d[0] === expected[0] && d[1] === expected[1])
    const values = dice.map(d => `[${d[0]}, ${d[1]}]`).join(', ')
    return {
      pass,
      message: () =>
        pass
          ? `expected ${unitType} dice [${values}] not to contain [${expected}]`
          : `expected ${unitType} dice [${values}] to contain [${expected}]`,
    }
  },
})

interface CustomMatchers<R = unknown> {
  toContainDice(unitType: UnitType, expected: [number, number]): R
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion extends CustomMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
