import { describe, expect, it } from 'vitest'

import baseUnits from '@/data/base-units'
import type {
  FactionKey,
  Unit,
  UnitDefinition,
  UnitStats,
  UnitType,
} from '@/types'

import { CombatEngine } from './combat-engine'
import { flattenTree } from './probability/flatten-tree'
import { CombatState } from './state/combat-state'
import type { CombatMode, SideState } from './state/types'
import type { CombatOutcome } from './types'

const TEST_FACTION: FactionKey = 'ARBOREC'

/**
 * Get stats for all units from base_units.json.
 * @param upgrades - Record of which units are upgraded
 */
function getUnitDataStats(
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
        UNIT_ABILITIES: {
          ...(def.BASE as UnitStats | null)?.UNIT_ABILITIES,
          ...def.UPGRADED.UNIT_ABILITIES,
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
        UNIT_ABILITIES: unitStats?.UNIT_ABILITIES,
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
  const units = getUnitDataStats()

  describe('simulate', () => {
    it('2 cruisers vs 3 cruisers', () => {
      const engine = new CombatEngine()

      const state = new CombatState(
        createSideState(createUnits(units, { CRUISER: 2 })),
        createSideState(createUnits(units, { CRUISER: 3 })),
        'SPACE',
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
        'SPACE',
      )

      const result = engine.simulate(state)

      const outcomes = flattenTree(result)
      const summary = summarizeOutcomes(outcomes)

      // Verify probabilities sum to 1
      const total = summary.attackerWin + summary.draw + summary.defenderWin
      expect(total).toBeCloseTo(1.0, 10)

      // Expected values from simulation
      expect(summary.attackerWin).toBeCloseTo(0.0972, 5)
      expect(summary.draw).toBeCloseTo(0.060958, 5)
      expect(summary.defenderWin).toBeCloseTo(0.84184, 5)
    })

    it('2 fighters vs upgraded destroyer (with AFB)', () => {
      const engine = new CombatEngine()
      const defenderStats = getUnitDataStats({ DESTROYER: true })

      const state = new CombatState(
        createSideState(createUnits(units, { FIGHTER: 2 })),
        createSideState(createUnits(defenderStats, { DESTROYER: 1 })),
        'SPACE',
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

    it('1 infantry vs 1 infantry (ground combat)', () => {
      const engine = new CombatEngine()
      const combatMode: CombatMode = 'GROUND'

      const state = new CombatState(
        createSideState(createUnits(units, { INFANTRY: 1 })),
        createSideState(createUnits(units, { INFANTRY: 1 })),
        combatMode,
      )

      const result = engine.simulate(state)

      const outcomes = flattenTree(result)
      const summary = summarizeOutcomes(outcomes)

      // Verify probabilities sum to 1
      const total = summary.attackerWin + summary.draw + summary.defenderWin
      expect(total).toBeCloseTo(1.0, 10)

      // 1 infantry vs 1 infantry should be roughly symmetric
      // Infantry has COMBAT: [8, 1] meaning 30% hit chance (rolls 8+)
      // Both sides have equal chance, with some draw probability
      expect(summary.attackerWin).toBeCloseTo(summary.defenderWin, 1)
      expect(summary.draw).toBeGreaterThan(0)
    })

    it('2 infantry vs 1 infantry (ground combat)', () => {
      const engine = new CombatEngine()
      const combatMode: CombatMode = 'GROUND'

      const state = new CombatState(
        createSideState(createUnits(units, { INFANTRY: 2 })),
        createSideState(createUnits(units, { INFANTRY: 1 })),
        combatMode,
      )

      const result = engine.simulate(state)

      const outcomes = flattenTree(result)
      const summary = summarizeOutcomes(outcomes)

      // Verify probabilities sum to 1
      const total = summary.attackerWin + summary.draw + summary.defenderWin
      expect(total).toBeCloseTo(1.0, 10)

      // 2 infantry should beat 1 infantry most of the time
      expect(summary.attackerWin).toBeGreaterThan(summary.defenderWin)
    })
  })

  describe('Bombardment win conditions', () => {
    it('ends combat immediately if Bombardment destroys all ground forces', () => {
      const engine = new CombatEngine()
      const combatMode: CombatMode = 'GROUND'

      // Create custom units with guaranteed bombardment hits
      // Bombardment [1, 10] = 10 dice hitting on 1+ (100% hit rate per die)
      const dreadnoughtWithGuaranteedBombardment: Partial<
        Record<UnitType, Unit[]>
      > = {
        DREADNOUGHT: [
          {
            COMBAT: [5, 1],
            UNIT_ABILITIES: { BOMBARDMENT: [1, 10] }, // 10 dice at 1+ (guaranteed 10 hits)
          },
        ],
      }

      const state = new CombatState(
        createSideState(dreadnoughtWithGuaranteedBombardment),
        createSideState(createUnits(units, { INFANTRY: 1 })),
        combatMode,
      )

      const result = engine.simulate(state)
      const outcomes = flattenTree(result)
      const summary = summarizeOutcomes(outcomes)

      expect(summary.draw).toBe(1.0)
    })

    it('continues to ground combat when Bombardment leaves survivors', () => {
      const engine = new CombatEngine()
      const combatMode: CombatMode = 'GROUND'

      // Dreadnought with weak bombardment (1 die hitting on 5+ = 60%)
      const dreadnoughtWithWeakBombardment: Partial<Record<UnitType, Unit[]>> =
        {
          DREADNOUGHT: [
            {
              COMBAT: [5, 1],
              UNIT_ABILITIES: { BOMBARDMENT: [5, 1] }, // 1 die at 5+ (60% hit)
            },
          ],
          INFANTRY: [
            {
              COMBAT: [8, 1],
              UNIT_ABILITIES: {},
            },
          ],
        }

      const state = new CombatState(
        createSideState(dreadnoughtWithWeakBombardment),
        createSideState(createUnits(units, { INFANTRY: 5 })),
        combatMode,
      )

      const result = engine.simulate(state)
      const outcomes = flattenTree(result)
      const summary = summarizeOutcomes(outcomes)

      // Verify probabilities sum to 1
      const total = summary.attackerWin + summary.draw + summary.defenderWin
      expect(total).toBeCloseTo(1.0, 10)

      // With only 1 bombardment die vs 5 infantry, the combat should
      // continue to ground combat and defender should have a chance to win
      expect(summary.defenderWin).toBeGreaterThan(0)
    })

    it('War Sun bombardment kills lone Infantry with high probability', () => {
      const engine = new CombatEngine()
      const combatMode: CombatMode = 'GROUND'

      // War Sun has BOMBARDMENT: [3, 3] = 3 dice hitting on 3+ (80% each)
      // Against 1 Infantry, probability of at least 1 hit: 1 - 0.2^3 = 99.2%
      const warSunUnits: Partial<Record<UnitType, Unit[]>> = {
        WAR_SUN: [
          {
            COMBAT: [3, 3],
            UNIT_ABILITIES: { BOMBARDMENT: [3, 3] },
          },
        ],
        INFANTRY: [
          {
            COMBAT: [8, 1],
            UNIT_ABILITIES: {},
          },
        ],
      }

      const state = new CombatState(
        createSideState(warSunUnits),
        createSideState(createUnits(units, { INFANTRY: 1 })),
        combatMode,
      )

      const result = engine.simulate(state)
      const outcomes = flattenTree(result)
      const summary = summarizeOutcomes(outcomes)

      // Verify probabilities sum to 1
      const total = summary.attackerWin + summary.draw + summary.defenderWin
      expect(total).toBeCloseTo(1.0, 10)

      // With 3 dice at 80% each, high probability of killing the lone Infantry
      // Attacker should win most of the time
      expect(summary.attackerWin).toBeGreaterThan(0.9)
    })

    it('ground combat flow: BOMBARDMENT -> SPACE_CANNON_DEFENSE -> GROUND_COMBAT', () => {
      const engine = new CombatEngine()
      const combatMode: CombatMode = 'GROUND'

      // Simple ground combat with Dreadnought bombardment
      const attackerUnits: Partial<Record<UnitType, Unit[]>> = {
        DREADNOUGHT: [
          {
            COMBAT: [5, 1],
            UNIT_ABILITIES: { BOMBARDMENT: [10, 1] }, // Weak bombardment (miss on 1-9)
          },
        ],
        INFANTRY: [
          {
            COMBAT: [8, 1],
            UNIT_ABILITIES: {},
          },
          {
            COMBAT: [8, 1],
            UNIT_ABILITIES: {},
          },
        ],
      }

      const state = new CombatState(
        createSideState(attackerUnits),
        createSideState(createUnits(units, { INFANTRY: 2 })),
        combatMode,
      )

      // Verify initial phase is BOMBARDMENT
      expect(state.currentPhase?.meta).toBe('BOMBARDMENT')

      const result = engine.simulate(state)
      const outcomes = flattenTree(result)

      // flattenTree returns CombatOutcome which has winner/attacker/defender/probability
      // We verify the combat completed properly by checking we have valid outcomes
      expect(outcomes.length).toBeGreaterThan(0)

      const summary = summarizeOutcomes(outcomes)
      const total = summary.attackerWin + summary.draw + summary.defenderWin
      expect(total).toBeCloseTo(1.0, 10)

      // Combat should have some attacker wins and some defender wins
      // (2 infantry vs 2 infantry with weak bombardment)
      expect(summary.attackerWin).toBeGreaterThan(0)
      expect(summary.defenderWin).toBeGreaterThan(0)
    })
  })
})
