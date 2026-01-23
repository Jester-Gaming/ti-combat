import { describe, it, expect } from 'vitest'
import { CombatEngine } from './CombatEngine'
import { flattenTree } from './probability/flattenTree'
import type { CombatOutcome } from './types'
import type { UnitStats, UnitType, UnitDefinition } from '@/types'
import baseUnits from '@/data/base_units.json'

/**
 * Get stats for all units from base_units.json.
 * @param upgrades - Record of which units are upgraded
 */
function getUnitStats(
  upgrades: Partial<Record<UnitType, boolean>> = {},
): Record<UnitType, UnitStats> {
  const result = {} as Record<UnitType, UnitStats>

  for (const [unitType, unitDef] of Object.entries(baseUnits)) {
    const def = unitDef as UnitDefinition
    const isUpgraded = upgrades[unitType as UnitType] ?? false

    if (isUpgraded && def.UPGRADED) {
      result[unitType as UnitType] = {
        ...def.BASE,
        ...def.UPGRADED,
        ABILITIES: {
          ...(def.BASE as UnitStats | null)?.ABILITIES,
          ...def.UPGRADED.ABILITIES,
        },
      } as UnitStats
    } else if (def.BASE) {
      result[unitType as UnitType] = { ...def.BASE } as UnitStats
    } else if (def.UPGRADED) {
      result[unitType as UnitType] = { ...def.UPGRADED } as UnitStats
    }
  }

  return result
}

/**
 * Sum probabilities by outcome type (win/draw/lose).
 */
function summarizeOutcomes(outcomes: CombatOutcome[]): {
  attackerWin: number
  draw: number
  defenderWin: number
} {
  let attackerWin = 0
  let draw = 0
  let defenderWin = 0

  for (const outcome of outcomes) {
    if (outcome.winner === 'attacker') {
      attackerWin += outcome.probability
    } else if (outcome.winner === 'defender') {
      defenderWin += outcome.probability
    } else {
      draw += outcome.probability
    }
  }

  return { attackerWin, draw, defenderWin }
}

describe('CombatEngine', () => {
  const units = getUnitStats()

  describe('simulate', () => {
    it('2 cruisers vs 3 cruisers', () => {
      const engine = new CombatEngine()

      const result = engine.simulate(units, { CRUISER: 2 }, units, {
        CRUISER: 3,
      })

      const outcomes = flattenTree(result)
      const summary = summarizeOutcomes(outcomes)

      // Verify probabilities sum to 1
      const total = summary.attackerWin + summary.draw + summary.defenderWin
      expect(total).toBeCloseTo(1.0, 10)

      // Expected values from simulation
      expect(summary.attackerWin).toBeCloseTo(0.12773, 5)
      expect(summary.draw).toBeCloseTo(0.04435, 5)
      expect(summary.defenderWin).toBeCloseTo(0.82792, 5)
    })

    it('2 cruisers vs 1 dreadnought + 1 cruiser', () => {
      const engine = new CombatEngine()

      const result = engine.simulate(units, { CRUISER: 2 }, units, {
        DREADNOUGHT: 1,
        CRUISER: 1,
      })

      const outcomes = flattenTree(result)
      const summary = summarizeOutcomes(outcomes)

      // Verify probabilities sum to 1
      const total = summary.attackerWin + summary.draw + summary.defenderWin
      expect(total).toBeCloseTo(1.0, 10)

      // Expected values from simulation
      expect(summary.attackerWin).toBeCloseTo(0.29643, 5)
      expect(summary.draw).toBeCloseTo(0.14561, 5)
      expect(summary.defenderWin).toBeCloseTo(0.55796, 5)
    })

    it('2 fighters vs upgraded destroyer (with AFB)', () => {
      const engine = new CombatEngine()
      const defenderUnits = getUnitStats({ DESTROYER: true })

      const result = engine.simulate(units, { FIGHTER: 2 }, defenderUnits, {
        DESTROYER: 1,
      })

      const outcomes = flattenTree(result)
      const summary = summarizeOutcomes(outcomes)

      // Verify probabilities sum to 1
      const total = summary.attackerWin + summary.draw + summary.defenderWin
      expect(total).toBeCloseTo(1.0, 10)

      // Expected values from simulation
      expect(summary.attackerWin).toBeCloseTo(0.18216, 5)
      expect(summary.draw).toBeCloseTo(0.05764, 5)
      expect(summary.defenderWin).toBeCloseTo(0.76021, 5)
    })
  })
})
