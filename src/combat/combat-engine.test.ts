import { describe, expect, it } from 'vitest'

import baseUnits from '@/data/base-units'
import type {
  FactionKey,
  UnitBaseType,
  UnitDefinition,
  UnitId,
  UnitStats,
} from '@/types'

import { CombatEngine } from './combat-engine'
import { CombatState } from './combat-state/combat-state'
import type { CombatMode, SideStateData } from './combat-state/types'
import type { CombatOutcome } from './types'
import { nextUnitIds } from './utils/unit-id'

const TEST_FACTION: FactionKey = 'ARBOREC'

/**
 * Get stats for all units from base_units.json.
 * @param upgrades - Record of which units are upgraded
 */
function getUnitDataStats(
  upgrades: Partial<Record<UnitBaseType, boolean>> = {},
): Record<UnitBaseType, UnitStats> {
  const result = {} as Record<UnitBaseType, UnitStats>

  for (const [unitType, unitDef] of Object.entries(baseUnits)) {
    const def = unitDef as UnitDefinition
    const isUpgraded = upgrades[unitType as UnitBaseType] ?? false

    if (isUpgraded && def.UPGRADED) {
      result[unitType as UnitBaseType] = {
        ...def.BASE,
        ...def.UPGRADED,
        UNIT_ABILITIES: {
          ...(def.BASE as UnitStats | null)?.UNIT_ABILITIES,
          ...def.UPGRADED.UNIT_ABILITIES,
        },
      } as UnitStats
    } else if (def.BASE) {
      result[unitType as UnitBaseType] = { ...def.BASE } as UnitStats
    } else if (def.UPGRADED) {
      result[unitType as UnitBaseType] = { ...def.UPGRADED } as UnitStats
    }
  }

  return result
}

/**
 * Create SideStateData in compact format.
 */
function createSideState(
  counts: Partial<Record<UnitBaseType, number>>,
  customStats?: Partial<Record<UnitBaseType, UnitStats>>,
  defaultStats?: Record<UnitBaseType, UnitStats>,
): SideStateData {
  const allStats = defaultStats ?? getUnitDataStats()
  const units: Record<string, UnitId[]> = {}
  const unitStats: Record<string, UnitStats> = {}

  for (const [type, count] of Object.entries(counts)) {
    if (count && count > 0) {
      const unitType = type as UnitBaseType
      units[unitType] = nextUnitIds(count)
      unitStats[unitType] = customStats?.[unitType] ?? allStats[unitType]
    }
  }

  return {
    faction: TEST_FACTION,
    units,
    unitState: {},
    unitStats,
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
  const stats = getUnitDataStats()

  describe('simulate', () => {
    it('2 cruisers vs 3 cruisers', () => {
      const engine = new CombatEngine()

      const state = CombatState.forSimulation(
        createSideState({ CRUISER: 2 }, undefined, stats),
        createSideState({ CRUISER: 3 }, undefined, stats),
        'SPACE',
      )

      const outcomes = engine.simulate(state)
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

      const state = CombatState.forSimulation(
        createSideState({ CRUISER: 2 }, undefined, stats),
        createSideState({ DREADNOUGHT: 1, CRUISER: 1 }, undefined, stats),
        'SPACE',
      )

      const outcomes = engine.simulate(state)
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

      const state = CombatState.forSimulation(
        createSideState({ FIGHTER: 2 }, undefined, stats),
        createSideState({ DESTROYER: 1 }, undefined, defenderStats),
        'SPACE',
      )

      const outcomes = engine.simulate(state)
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

      const state = CombatState.forSimulation(
        createSideState({ INFANTRY: 1 }, undefined, stats),
        createSideState({ INFANTRY: 1 }, undefined, stats),
        combatMode,
      )

      const outcomes = engine.simulate(state)
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

      const state = CombatState.forSimulation(
        createSideState({ INFANTRY: 2 }, undefined, stats),
        createSideState({ INFANTRY: 1 }, undefined, stats),
        combatMode,
      )

      const outcomes = engine.simulate(state)
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

      const state = CombatState.forSimulation(
        createSideState(
          { DREADNOUGHT: 1 },
          {
            DREADNOUGHT: {
              COMBAT: [5, 1],
              UNIT_ABILITIES: { BOMBARDMENT: [1, 10] },
            },
          },
        ),
        createSideState({ INFANTRY: 1 }, undefined, stats),
        combatMode,
      )

      const outcomes = engine.simulate(state)
      const summary = summarizeOutcomes(outcomes)

      expect(summary.draw).toBe(1.0)
    })

    it('continues to ground combat when Bombardment leaves survivors', () => {
      const engine = new CombatEngine()
      const combatMode: CombatMode = 'GROUND'

      const state = CombatState.forSimulation(
        createSideState(
          { DREADNOUGHT: 1, INFANTRY: 1 },
          {
            DREADNOUGHT: {
              COMBAT: [5, 1],
              UNIT_ABILITIES: { BOMBARDMENT: [5, 1] },
            },
            INFANTRY: { COMBAT: [8, 1], UNIT_ABILITIES: {} },
          },
        ),
        createSideState({ INFANTRY: 5 }, undefined, stats),
        combatMode,
      )

      const outcomes = engine.simulate(state)
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

      const state = CombatState.forSimulation(
        createSideState(
          { WAR_SUN: 1, INFANTRY: 1 },
          {
            WAR_SUN: {
              COMBAT: [3, 3],
              UNIT_ABILITIES: { BOMBARDMENT: [3, 3] },
            },
            INFANTRY: { COMBAT: [8, 1], UNIT_ABILITIES: {} },
          },
        ),
        createSideState({ INFANTRY: 1 }, undefined, stats),
        combatMode,
      )

      const outcomes = engine.simulate(state)
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

      const state = CombatState.forSimulation(
        createSideState(
          { DREADNOUGHT: 1, INFANTRY: 2 },
          {
            DREADNOUGHT: {
              COMBAT: [5, 1],
              UNIT_ABILITIES: { BOMBARDMENT: [10, 1] },
            },
            INFANTRY: { COMBAT: [8, 1], UNIT_ABILITIES: {} },
          },
        ),
        createSideState({ INFANTRY: 2 }, undefined, stats),
        combatMode,
      )

      // Verify initial phase is BOMBARDMENT
      expect(state.currentPhase?.meta).toBe('BOMBARDMENT')

      const outcomes = engine.simulate(state)

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
