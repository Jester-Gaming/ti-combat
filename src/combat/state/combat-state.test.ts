import { describe, expect, it } from 'vitest'

import type { FactionKey, UnitType } from '@/types'

import { settings } from '../abilities/list/general/settings'
import type { DicePool } from '../abilities/types'
import type { LogEntry } from '../types'
import { CombatState } from './combat-state'
import {
  addHits,
  assignHits,
  countUnits,
  destroyUnit,
  getUnit,
} from './side-state-ops'
import type { CombatSide, CombatStateData, SideState, Unit } from './types'

/** Extract hit count for a given side from log entries */
function getHitsFromLog(log: LogEntry[] | undefined, side: CombatSide): number {
  if (!log) return 0
  return log
    .filter(entry => entry[1] === 'DICE_ROLL' && entry[2] === side)
    .reduce((sum, entry) => sum + (entry[3] as number), 0)
}

/** Strip unit references from DicePool for test assertions */
function diceValues(
  pool: DicePool,
): Partial<Record<UnitType, [number, number][]>> {
  const result: Partial<Record<UnitType, [number, number][]>> = {}
  for (const [type, dice] of Object.entries(pool)) {
    if (dice) {
      result[type as UnitType] = dice.map(d => [d[0], d[1]])
    }
  }
  return result
}

// Test faction constant
const TEST_FACTION: FactionKey = 'ARBOREC'

// Default abilities config for tests
const DEFAULT_ABILITIES = {
  attacker: { abilities: [settings] },
  defender: { abilities: [settings] },
}

const EMPTY_ABILITIES = {
  attacker: { abilities: [] },
  defender: { abilities: [] },
}

// Helper to create units with stats
function createUnits(stats: Partial<Unit>, count: number): Unit[] {
  return Array.from({ length: count }, () => ({ ...stats }))
}

// Helper to create a side state
function createSideState(units: Partial<Record<string, Unit[]>>): SideState {
  return {
    faction: TEST_FACTION,
    units: units as SideState['units'],
    hitPools: [],
  }
}

describe('CombatState', () => {
  const fighterStats: Partial<Unit> = { COMBAT: [9, 1], UNIT_ABILITIES: {} }
  const cruiserStats: Partial<Unit> = { COMBAT: [7, 1], UNIT_ABILITIES: {} }
  const destroyerStats: Partial<Unit> = {
    COMBAT: [9, 1],
    UNIT_ABILITIES: { AFB: [9, 2] },
  }

  describe('constructor', () => {
    it('creates state with unit counts', () => {
      const state = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 2) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
        DEFAULT_ABILITIES,
        'SPACE',
      )

      expect(state.attacker.units.FIGHTER).toHaveLength(2)
      expect(state.defender.units.CRUISER).toHaveLength(1)
    })

    it('creates state with empty hit pools', () => {
      const state = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 1) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
        DEFAULT_ABILITIES,
        'SPACE',
      )

      expect(state.attacker.hitPools).toHaveLength(0)
      expect(state.defender.hitPools).toHaveLength(0)
    })
  })

  describe('collectDice', () => {
    it('collects combat dice from units', () => {
      const state = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 3) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 2) }),
        DEFAULT_ABILITIES,
        'SPACE',
      )

      const attackerDice = state.collectDice('attacker', 'COMBAT')
      const defenderDice = state.collectDice('defender', 'COMBAT')

      expect(diceValues(attackerDice)).toEqual({
        FIGHTER: [
          [9, 1],
          [9, 1],
          [9, 1],
        ],
      })
      expect(diceValues(defenderDice)).toEqual({
        CRUISER: [
          [7, 1],
          [7, 1],
        ],
      })
    })

    it('collects AFB dice from units with AFB ability', () => {
      const state = new CombatState(
        createSideState({ DESTROYER: createUnits(destroyerStats, 2) }),
        createSideState({}),
        DEFAULT_ABILITIES,
        'SPACE',
      )

      const dice = state.collectDice('attacker', 'AFB')
      expect(diceValues(dice)).toEqual({
        DESTROYER: [
          [9, 2],
          [9, 2],
        ],
      }) // 2 destroyers * 2 dice each
    })

    it('returns empty array for no matching units', () => {
      const state = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 1) }),
        createSideState({}),
        DEFAULT_ABILITIES,
        'SPACE',
      )

      const dice = state.collectDice('attacker', 'AFB')
      expect(dice).toEqual({})
    })
  })

  describe('assignHits', () => {
    it('destroys units based on pending hits for both sides', () => {
      const attackerSide = createSideState({
        FIGHTER: createUnits(fighterStats, 2),
      })
      const defenderSide = createSideState({
        CRUISER: createUnits(cruiserStats, 2),
      })

      // Add hits using side-state-ops
      let stateData: CombatStateData = {
        attacker: attackerSide,
        defender: defenderSide,
        abilities: DEFAULT_ABILITIES,
        combatMode: 'SPACE',
        currentPhase: { meta: 'SPACE_COMBAT', micro: 'ASSIGN_HITS' },
      }
      stateData = addHits(stateData, 'attacker', 1, [])
      stateData = addHits(stateData, 'defender', 1, [])

      const state = new CombatState(
        stateData.attacker,
        stateData.defender,
        stateData.abilities,
        stateData.combatMode,
        stateData.currentPhase,
      )
      const result = state.assignHits()

      expect(result.attacker.units.FIGHTER).toHaveLength(1)
      expect(result.defender.units.CRUISER).toHaveLength(1)
    })

    it('respects AFB pool filter (only targets fighters)', () => {
      const attackerSide = createSideState({
        FIGHTER: createUnits(fighterStats, 1),
        CRUISER: createUnits(cruiserStats, 1),
      })
      const defenderSide = createSideState({
        FIGHTER: createUnits(fighterStats, 2),
      })

      let stateData: CombatStateData = {
        attacker: attackerSide,
        defender: defenderSide,
        abilities: DEFAULT_ABILITIES,
        combatMode: 'SPACE',
        currentPhase: { meta: 'SPACE_COMBAT', micro: 'ASSIGN_HITS' },
      }
      stateData = addHits(stateData, 'attacker', 2, ['FIGHTER'])
      stateData = addHits(stateData, 'defender', 1, ['FIGHTER'])

      const state = new CombatState(
        stateData.attacker,
        stateData.defender,
        stateData.abilities,
        stateData.combatMode,
        stateData.currentPhase,
      )
      const result = state.assignHits()

      // AFB only targets fighters, so cruiser survives
      expect(result.attacker.units.FIGHTER).toBeUndefined()
      expect(result.attacker.units.CRUISER).toHaveLength(1)
      // Hit pools are cleared after assignHits (remaining hits are lost)
      expect(result.attacker.hitPools).toHaveLength(0)
      // Defender had 2 fighters, 1 hit applied
      expect(result.defender.units.FIGHTER).toHaveLength(1)
    })
  })

  describe('isFinished', () => {
    it('returns true when attacker eliminated', () => {
      const state = new CombatState(
        createSideState({}),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
        DEFAULT_ABILITIES,
        'SPACE',
      )

      expect(state.isFinished()).toBe(true)
    })

    it('returns true when defender eliminated', () => {
      const state = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 1) }),
        createSideState({}),
        DEFAULT_ABILITIES,
        'SPACE',
      )

      expect(state.isFinished()).toBe(true)
    })

    it('returns false when both sides have units', () => {
      const state = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 1) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
        DEFAULT_ABILITIES,
        'SPACE',
      )

      expect(state.isFinished()).toBe(false)
    })

    describe('pre-combat phases (ships vs PDS-only)', () => {
      const pdsStats: Partial<Unit> = {
        UNIT_ABILITIES: { SPACE_CANNON: [6, 1] },
      }

      it('returns false during SPACE_CANNON_OFFENSE even if defender has only PDS', () => {
        const state = new CombatState(
          createSideState({ CRUISER: createUnits(cruiserStats, 2) }),
          createSideState({ PDS: createUnits(pdsStats, 2) }),
          DEFAULT_ABILITIES,
          'SPACE',
          { meta: 'SPACE_CANNON_OFFENSE', micro: 'START' },
        )

        // Combat should NOT be finished during Space Cannon phase
        // even though defender has no ships (only PDS)
        expect(state.isFinished()).toBe(false)
      })

      it('returns false during SPACE_CANNON_OFFENSE even if attacker has only PDS', () => {
        const state = new CombatState(
          createSideState({ PDS: createUnits(pdsStats, 2) }),
          createSideState({ CRUISER: createUnits(cruiserStats, 2) }),
          DEFAULT_ABILITIES,
          'SPACE',
          { meta: 'SPACE_CANNON_OFFENSE', micro: 'DICE_ROLL' },
        )

        expect(state.isFinished()).toBe(false)
      })

      it('returns true when at COMPLETE phase', () => {
        const state = new CombatState(
          createSideState({ CRUISER: createUnits(cruiserStats, 2) }),
          createSideState({ PDS: createUnits(pdsStats, 2) }),
          DEFAULT_ABILITIES,
          'SPACE',
          { meta: 'COMPLETE', micro: 'END' },
        )

        expect(state.isFinished()).toBe(true)
      })

      it('returns true during SPACE_COMBAT if one side has no ships', () => {
        const state = new CombatState(
          createSideState({ CRUISER: createUnits(cruiserStats, 2) }),
          createSideState({ PDS: createUnits(pdsStats, 2) }),
          DEFAULT_ABILITIES,
          'SPACE',
          { meta: 'SPACE_COMBAT', micro: 'START' },
        )

        // During SPACE_COMBAT, defender has 0 participating units (PDS is not a ship)
        expect(state.isFinished()).toBe(true)
      })

      it('returns false at END micro-phase even when one side is eliminated', () => {
        // One side has no units, but we're at END micro-phase
        // END_OF_COMBAT_ROUND/END_OF_COMBAT abilities must fire
        const state = new CombatState(
          createSideState({ CRUISER: createUnits(cruiserStats, 2) }),
          createSideState({}),
          EMPTY_ABILITIES,
          'SPACE',
          { meta: 'SPACE_COMBAT', micro: 'END' },
        )

        expect(state.isFinished()).toBe(false)
      })

      it('returns false at END micro-phase during GROUND_COMBAT when eliminated', () => {
        const infantryStats: Partial<Unit> = {
          COMBAT: [8, 1],
          UNIT_ABILITIES: {},
        }
        const state = new CombatState(
          createSideState({ INFANTRY: createUnits(infantryStats, 1) }),
          createSideState({}),
          EMPTY_ABILITIES,
          'GROUND',
          { meta: 'GROUND_COMBAT', micro: 'END' },
        )

        expect(state.isFinished()).toBe(false)
      })
    })
  })

  describe('getHash', () => {
    it('returns same hash for identical states', () => {
      const state1 = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 2) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
        DEFAULT_ABILITIES,
        'SPACE',
      )
      const state2 = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 2) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
        DEFAULT_ABILITIES,
        'SPACE',
      )

      expect(state1.getHash()).toBe(state2.getHash())
    })

    it('returns different hash for different unit counts', () => {
      const state1 = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 2) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
        DEFAULT_ABILITIES,
        'SPACE',
      )
      const state2 = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 1) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
        DEFAULT_ABILITIES,
        'SPACE',
      )

      expect(state1.getHash()).not.toBe(state2.getHash())
    })
  })

  describe('getParticipatingUnits with combatMode', () => {
    const infantryStats: Partial<Unit> = { COMBAT: [8, 1], UNIT_ABILITIES: {} }
    const mechStats: Partial<Unit> = { COMBAT: [6, 1], UNIT_ABILITIES: {} }

    it('returns only ship types when combatMode is SPACE', () => {
      const state = new CombatState(
        createSideState({
          CRUISER: createUnits(cruiserStats, 2),
          FIGHTER: createUnits(fighterStats, 3),
          INFANTRY: createUnits(infantryStats, 4),
          MECH: createUnits(mechStats, 1),
        }),
        createSideState({}),
        {
          attacker: { abilities: [settings] },
          defender: { abilities: [] },
        },
        'SPACE',
      )

      const participating = state.getParticipatingUnits('attacker')

      // Should include space units
      expect(participating.has('CRUISER')).toBe(true)
      expect(participating.has('FIGHTER')).toBe(true)
      expect(participating.has('FLAGSHIP')).toBe(true)
      expect(participating.has('DREADNOUGHT')).toBe(true)

      // Should NOT include ground forces
      expect(participating.has('INFANTRY')).toBe(false)
      expect(participating.has('MECH')).toBe(false)
    })

    it('returns only ground force types when combatMode is GROUND', () => {
      const state = new CombatState(
        createSideState({
          CRUISER: createUnits(cruiserStats, 2),
          FIGHTER: createUnits(fighterStats, 3),
          INFANTRY: createUnits(infantryStats, 4),
          MECH: createUnits(mechStats, 1),
        }),
        createSideState({}),
        {
          attacker: { abilities: [settings] },
          defender: { abilities: [] },
        },
        'GROUND',
      )

      const participating = state.getParticipatingUnits('attacker')

      // Should include ground forces
      expect(participating.has('INFANTRY')).toBe(true)
      expect(participating.has('MECH')).toBe(true)

      // Should NOT include ships
      expect(participating.has('CRUISER')).toBe(false)
      expect(participating.has('FIGHTER')).toBe(false)
      expect(participating.has('FLAGSHIP')).toBe(false)
      expect(participating.has('DREADNOUGHT')).toBe(false)
    })

    it('defaults to space units when combatMode is SPACE', () => {
      const state = new CombatState(
        createSideState({
          CRUISER: createUnits(cruiserStats, 2),
          INFANTRY: createUnits(infantryStats, 4),
        }),
        createSideState({}),
        {
          attacker: { abilities: [settings] },
          defender: { abilities: [] },
        },
        'SPACE',
      )

      const participating = state.getParticipatingUnits('attacker')

      // Should include space units (default behavior)
      expect(participating.has('CRUISER')).toBe(true)
      expect(participating.has('FIGHTER')).toBe(true)

      // Should NOT include ground forces
      expect(participating.has('INFANTRY')).toBe(false)
      expect(participating.has('MECH')).toBe(false)
    })

    it('dice collection respects combat mode (ground combat excludes ships)', () => {
      const state = new CombatState(
        createSideState({
          CRUISER: createUnits(cruiserStats, 2), // Ships have combat value
          INFANTRY: createUnits(infantryStats, 4), // Ground forces have combat value
        }),
        createSideState({}),
        {
          attacker: { abilities: [settings] },
          defender: { abilities: [] },
        },
        'GROUND',
      )

      const dice = state.collectDice('attacker', 'COMBAT')

      // Should only collect dice from ground forces (infantry)
      // Infantry has COMBAT: [8, 1], so 4 infantry = 4 entries
      expect(diceValues(dice)).toEqual({
        INFANTRY: [
          [8, 1],
          [8, 1],
          [8, 1],
          [8, 1],
        ],
      })

      // Cruisers should NOT contribute dice (they are not participating in ground combat)
    })

    it('dice collection respects combat mode (space combat excludes ground forces)', () => {
      const state = new CombatState(
        createSideState({
          CRUISER: createUnits(cruiserStats, 2),
          INFANTRY: createUnits(infantryStats, 4),
        }),
        createSideState({}),
        {
          attacker: { abilities: [settings] },
          defender: { abilities: [] },
        },
        'SPACE',
      )

      const dice = state.collectDice('attacker', 'COMBAT')

      // Should only collect dice from ships (cruisers)
      // Cruiser has COMBAT: [7, 1], so 2 cruisers = 2 entries
      expect(diceValues(dice)).toEqual({
        CRUISER: [
          [7, 1],
          [7, 1],
        ],
      })

      // Infantry should NOT contribute dice (they are not participating in space combat)
    })
  })

  describe('phase transitions (ships vs PDS-only)', () => {
    const pdsStats: Partial<Unit> = {
      UNIT_ABILITIES: { SPACE_CANNON: [6, 1] },
    }

    it('skips to COMPLETE when transitioning from SPACE_CANNON_OFFENSE if defender has only PDS', () => {
      // Attacker has ships, defender has only PDS
      const state = new CombatState(
        createSideState({ CRUISER: createUnits(cruiserStats, 2) }),
        createSideState({ PDS: createUnits(pdsStats, 2) }),
        DEFAULT_ABILITIES,
        'SPACE',
        { meta: 'SPACE_CANNON_OFFENSE', micro: 'ASSIGN_HITS' }, // Last micro-phase for unit abilities
      )

      // Advancing from ASSIGN_HITS should transition to next meta-phase
      const outcomes = state.advance(1)

      expect(outcomes).toHaveLength(1)
      expect(outcomes[0].probability).toBe(1)
      // Should skip SPACE_COMBAT and go to COMPLETE
      expect(outcomes[0].state.currentPhase?.meta).toBe('COMPLETE')
    })

    it('skips to COMPLETE when transitioning from SPACE_CANNON_OFFENSE if attacker has only PDS', () => {
      // Attacker has only PDS, defender has ships
      const state = new CombatState(
        createSideState({ PDS: createUnits(pdsStats, 2) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 2) }),
        DEFAULT_ABILITIES,
        'SPACE',
        { meta: 'SPACE_CANNON_OFFENSE', micro: 'ASSIGN_HITS' }, // Last micro-phase for unit abilities
      )

      const outcomes = state.advance(1)

      expect(outcomes).toHaveLength(1)
      expect(outcomes[0].state.currentPhase?.meta).toBe('COMPLETE')
    })

    it('proceeds to SPACE_COMBAT when both sides have ships', () => {
      const state = new CombatState(
        createSideState({ CRUISER: createUnits(cruiserStats, 2) }),
        createSideState({ DESTROYER: createUnits(destroyerStats, 2) }),
        DEFAULT_ABILITIES,
        'SPACE',
        { meta: 'SPACE_CANNON_OFFENSE', micro: 'ASSIGN_HITS' }, // Last micro-phase for unit abilities
      )

      const outcomes = state.advance(1)

      expect(outcomes).toHaveLength(1)
      expect(outcomes[0].state.currentPhase?.meta).toBe('SPACE_COMBAT')
    })

    it('collects Space Cannon dice from PDS during SPACE_CANNON_OFFENSE', () => {
      const state = new CombatState(
        createSideState({ CRUISER: createUnits(cruiserStats, 2) }),
        createSideState({ PDS: createUnits(pdsStats, 3) }),
        DEFAULT_ABILITIES,
        'SPACE',
        { meta: 'SPACE_CANNON_OFFENSE', micro: 'START' },
      )

      // Defender's PDS should contribute dice for Space Cannon
      const dice = state.collectDice('defender', 'SPACE_CANNON')
      expect(diceValues(dice)).toEqual({
        PDS: [
          [6, 1],
          [6, 1],
          [6, 1],
        ],
      }) // 3 PDS with [6, 1] each
    })
  })
})

describe('Bombardment', () => {
  const dreadnoughtStats: Partial<Unit> = {
    COMBAT: [5, 1],
    UNIT_ABILITIES: { BOMBARDMENT: [5, 1] },
  }
  const warSunStats: Partial<Unit> = {
    COMBAT: [3, 3],
    UNIT_ABILITIES: { BOMBARDMENT: [3, 3] },
  }
  const infantryStats: Partial<Unit> = { COMBAT: [8, 1], UNIT_ABILITIES: {} }
  const mechStats: Partial<Unit> = { COMBAT: [6, 1], UNIT_ABILITIES: {} }
  const cruiserStats: Partial<Unit> = { COMBAT: [7, 1], UNIT_ABILITIES: {} }

  it('attacker Dreadnought bombards defender Infantry', () => {
    const state = new CombatState(
      createSideState({ DREADNOUGHT: createUnits(dreadnoughtStats, 2) }),
      createSideState({ INFANTRY: createUnits(infantryStats, 3) }),
      DEFAULT_ABILITIES,
      'GROUND',
      { meta: 'BOMBARDMENT', micro: 'DICE_ROLL' },
    )

    const results = state.advance(1)

    // Multiple outcomes based on hit probabilities
    // Dreadnought BOMBARDMENT: [5, 1] means hit on 5+, so 60% hit chance per die
    // 2 dreadnoughts = 2 dice total
    expect(results.length).toBeGreaterThan(1)

    // All outcomes should have hits assigned to defender
    for (const result of results) {
      // log contains DICE_ROLL entries — attacker's hits go to defender
      const bombardmentHits = getHitsFromLog(result.log, 'attacker')
      // Should have hit pools on defender (if hits occurred)
      if (bombardmentHits > 0) {
        expect(result.state.defender.hitPools.length).toBeGreaterThan(0)
      }
    }

    // Probabilities should sum to 1
    const totalProb = results.reduce((sum, r) => sum + r.probability, 0)
    expect(totalProb).toBeCloseTo(1.0, 10)
  })

  it('multiple ships combine dice into single pool', () => {
    // 2 Dreadnoughts (2 dice) + 1 War Sun (3 dice) = 5 dice total
    const state = new CombatState(
      createSideState({
        DREADNOUGHT: createUnits(dreadnoughtStats, 2),
        WAR_SUN: createUnits(warSunStats, 1),
      }),
      createSideState({ INFANTRY: createUnits(infantryStats, 5) }),
      DEFAULT_ABILITIES,
      'GROUND',
      { meta: 'BOMBARDMENT', micro: 'DICE_ROLL' },
    )

    const results = state.advance(1)

    // With 5 dice, we can get 0-5 hits, so should have multiple outcomes
    expect(results.length).toBeGreaterThan(1)

    // Find max hits in any outcome
    const maxHits = Math.max(
      ...results.map(r => getHitsFromLog(r.log, 'attacker')),
    )
    // With 5 dice, max hits should be at least 2 (very likely some hit)
    // But can go up to 5
    expect(maxHits).toBeLessThanOrEqual(5)

    // Probabilities should sum to 1
    const totalProb = results.reduce((sum, r) => sum + r.probability, 0)
    expect(totalProb).toBeCloseTo(1.0, 10)
  })

  it('bombardment only targets ground forces (Infantry/Mech)', () => {
    // Defender has Infantry, Mech, AND Cruiser
    // Cruiser should NOT be targeted by bombardment
    const state = new CombatState(
      createSideState({ DREADNOUGHT: createUnits(dreadnoughtStats, 2) }),
      createSideState({
        INFANTRY: createUnits(infantryStats, 2),
        MECH: createUnits(mechStats, 1),
        CRUISER: createUnits(cruiserStats, 1),
      }),
      DEFAULT_ABILITIES,
      'GROUND',
      { meta: 'BOMBARDMENT', micro: 'DICE_ROLL' },
    )

    const results = state.advance(1)

    // All outcomes should have hit pools targeting ground forces only
    for (const result of results) {
      for (const pool of result.state.defender.hitPools) {
        // Valid targets should be ground forces, not ships
        const targets = [...pool.validTargets]
        expect(targets).toContain('INFANTRY')
        expect(targets).toContain('MECH')
        expect(targets).not.toContain('CRUISER')
        expect(targets).not.toContain('FIGHTER')
        expect(targets).not.toContain('DREADNOUGHT')
      }
    }
  })

  it('only attacker fires (one-way bombardment)', () => {
    // Defender also has ships with Bombardment, but should NOT fire back
    const state = new CombatState(
      createSideState({ DREADNOUGHT: createUnits(dreadnoughtStats, 1) }),
      createSideState({
        INFANTRY: createUnits(infantryStats, 2),
        DREADNOUGHT: createUnits(dreadnoughtStats, 2), // Defender has Dreadnoughts too
      }),
      DEFAULT_ABILITIES,
      'GROUND',
      { meta: 'BOMBARDMENT', micro: 'DICE_ROLL' },
    )

    const results = state.advance(1)

    // All outcomes should have:
    // - attacker rolled dice (DICE_ROLL, 'attacker')
    // - defender did NOT roll (no DICE_ROLL for 'defender')
    for (const result of results) {
      expect(getHitsFromLog(result.log, 'defender')).toBe(0) // Defender didn't roll
      // Attacker should have no hit pools (defender didn't fire)
      expect(result.state.attacker.hitPools).toHaveLength(0)
    }
  })

  it('ships without Bombardment ability produce 0 dice', () => {
    // Cruisers don't have Bombardment ability
    const state = new CombatState(
      createSideState({ CRUISER: createUnits(cruiserStats, 3) }),
      createSideState({ INFANTRY: createUnits(infantryStats, 3) }),
      DEFAULT_ABILITIES,
      'GROUND',
      { meta: 'BOMBARDMENT', micro: 'DICE_ROLL' },
    )

    const results = state.advance(1)

    // Should have single outcome (no dice = deterministic 0 hits)
    expect(results).toHaveLength(1)
    expect(results[0].probability).toBe(1)
    expect(getHitsFromLog(results[0].log, 'attacker')).toBe(0) // No bombardment hits
    expect(results[0].state.defender.hitPools).toHaveLength(0)
  })

  it('transitions correctly through micro-phases', () => {
    // Unit ability phases only have DICE_ROLL -> ASSIGN_HITS (no START/END)
    const state = new CombatState(
      createSideState({ DREADNOUGHT: createUnits(dreadnoughtStats, 1) }),
      createSideState({ INFANTRY: createUnits(infantryStats, 2) }),
      DEFAULT_ABILITIES,
      'GROUND',
      { meta: 'BOMBARDMENT', micro: 'DICE_ROLL' }, // First micro-phase for unit abilities
    )

    // DICE_ROLL -> ASSIGN_HITS (with probability branching)
    const afterDice = state.advance(1)
    expect(afterDice.length).toBeGreaterThan(0)
    for (const outcome of afterDice) {
      expect(outcome.state.currentPhase?.meta).toBe('BOMBARDMENT')
      expect(outcome.state.currentPhase?.micro).toBe('ASSIGN_HITS')
    }

    // ASSIGN_HITS -> SPACE_CANNON_DEFENSE:DICE_ROLL (next meta-phase)
    const afterAssign = afterDice[0].state.advance(1)
    expect(afterAssign).toHaveLength(1)
    expect(afterAssign[0].state.currentPhase?.meta).toBe('SPACE_CANNON_DEFENSE')
    expect(afterAssign[0].state.currentPhase?.micro).toBe('DICE_ROLL') // First micro-phase for unit abilities
  })
})

describe('SideState operations', () => {
  const fighterStats: Partial<Unit> = { COMBAT: [9, 1], UNIT_ABILITIES: {} }
  const cruiserStats: Partial<Unit> = { COMBAT: [7, 1], UNIT_ABILITIES: {} }

  function createSideState(units: Partial<Record<string, Unit[]>>): SideState {
    return {
      faction: TEST_FACTION,
      units: units as SideState['units'],
      hitPools: [],
    }
  }

  // Helper to create a minimal CombatState for testing
  function wrapSide(side: SideState): CombatStateData {
    return {
      attacker: side,
      defender: createSideState({}),
      abilities: EMPTY_ABILITIES,
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }
  }

  describe('addHits', () => {
    it('returns same state for zero hits', () => {
      const state = wrapSide(
        createSideState({ FIGHTER: [{ ...fighterStats }] }),
      )
      const result = addHits(state, 'attacker', 0, [])
      expect(result).toBe(state)
    })

    it('adds hits to pool', () => {
      const state = wrapSide(
        createSideState({ FIGHTER: [{ ...fighterStats }] }),
      )
      const result = addHits(state, 'attacker', 2, [])
      expect(result.attacker.hitPools[0]?.hits).toBe(2)
    })
  })

  describe('assignHits', () => {
    it('destroys cheapest units first', () => {
      const state = wrapSide(
        createSideState({
          FIGHTER: [{ ...fighterStats }, { ...fighterStats }],
          CRUISER: [{ ...cruiserStats }, { ...cruiserStats }],
        }),
      )
      const participating = new Set(['FIGHTER', 'CRUISER'] as const)
      const withHits = addHits(state, 'attacker', 2, [])
      const result = assignHits(withHits, 'attacker', participating)

      expect(result.attacker.units.FIGHTER).toBeUndefined()
      expect(result.attacker.units.CRUISER).toHaveLength(2)
    })
  })

  describe('countUnits', () => {
    it('counts total units across all types', () => {
      const side = createSideState({
        FIGHTER: [{ ...fighterStats }, { ...fighterStats }],
        CRUISER: [{ ...cruiserStats }],
      })
      expect(countUnits(side)).toBe(3)
    })

    it('returns 0 for empty state', () => {
      const side = createSideState({})
      expect(countUnits(side)).toBe(0)
    })
  })

  describe('getUnit', () => {
    it('finds unit matching predicate', () => {
      const side = createSideState({
        FIGHTER: [
          { ...fighterStats, isDamaged: true },
          { ...fighterStats, isDamaged: false },
        ],
      })

      const undamaged = getUnit(side, 'FIGHTER', { isDamaged: false })
      expect(undamaged).toBeDefined()
      expect(undamaged?.unit.isDamaged).toBe(false)
    })

    it('returns undefined when no match', () => {
      const side = createSideState({
        FIGHTER: [{ ...fighterStats, isDamaged: true }],
      })

      const undamaged = getUnit(side, 'FIGHTER', { isDamaged: false })
      expect(undamaged).toBeUndefined()
    })
  })

  describe('destroyUnit', () => {
    it('removes specific unit', () => {
      const unit1 = { ...fighterStats }
      const unit2 = { ...fighterStats }
      const state = wrapSide(createSideState({ FIGHTER: [unit1, unit2] }))

      const result = destroyUnit(state, 'attacker', 'FIGHTER', 0)
      expect(result.attacker.units.FIGHTER).toHaveLength(1)
    })

    it('removes unit type when last unit destroyed', () => {
      const unit = { ...fighterStats }
      const state = wrapSide(createSideState({ FIGHTER: [unit] }))

      const result = destroyUnit(state, 'attacker', 'FIGHTER', 0)
      expect(result.attacker.units.FIGHTER).toBeUndefined()
    })
  })
})
