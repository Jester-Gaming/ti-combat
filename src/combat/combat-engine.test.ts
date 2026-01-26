import { describe, expect, it } from 'vitest'

import baseUnits from '@/data/base_units.json'
import type { FactionKey, UnitDefinition, UnitStats, UnitType } from '@/types'

import { CombatEngine } from './combat-engine'
import { flattenTree } from './probability/flatten-tree'
import { CombatState } from './state/combat-state'
import type { SideState, Unit } from './state/types'
import type { CombatOutcome } from './types'

const TEST_FACTION: FactionKey = 'ARBOREC'

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
 * Create unit arrays from stats and counts.
 */
function createUnits(
  stats: Record<UnitType, UnitStats>,
  counts: Partial<Record<UnitType, number>>,
): Partial<Record<UnitType, Unit[]>> {
  const units: Partial<Record<UnitType, Unit[]>> = {}

  for (const [type, count] of Object.entries(counts)) {
    if (count && count > 0) {
      const unitStats = stats[type as UnitType]
      units[type as UnitType] = Array.from({ length: count }, () => ({
        COMBAT: unitStats?.COMBAT,
        ABILITIES: unitStats?.ABILITIES,
      }))
    }
  }

  return units
}

/**
 * Create a SideState from units.
 */
function createSideState(units: Partial<Record<UnitType, Unit[]>>): SideState {
  return {
    faction: TEST_FACTION,
    units,
    hitPools: [],
  }
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

      const state = new CombatState(
        createSideState(createUnits(units, { CRUISER: 2 })),
        createSideState(createUnits(units, { CRUISER: 3 })),
      )

      const result = engine.simulate(state)

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

      const state = new CombatState(
        createSideState(createUnits(units, { CRUISER: 2 })),
        createSideState(createUnits(units, { DREADNOUGHT: 1, CRUISER: 1 })),
      )

      const result = engine.simulate(state)

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
      const defenderStats = getUnitStats({ DESTROYER: true })

      const state = new CombatState(
        createSideState(createUnits(units, { FIGHTER: 2 })),
        createSideState(createUnits(defenderStats, { DESTROYER: 1 })),
      )

      const result = engine.simulate(state)

      const outcomes = flattenTree(result)
      const summary = summarizeOutcomes(outcomes)

      // Verify probabilities sum to 1
      const total = summary.attackerWin + summary.draw + summary.defenderWin
      expect(total).toBeCloseTo(1.0, 10)

      // Expected values from simulation
      expect(summary.attackerWin).toBeCloseTo(0.21467, 5)
      expect(summary.draw).toBeCloseTo(0.057065, 5)
      expect(summary.defenderWin).toBeCloseTo(0.72826, 5)
    })
  })
})
