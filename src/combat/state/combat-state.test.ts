import { describe, expect, it } from 'vitest'

import type { DieValue, FactionKey } from '@/types'

import { participatingUnits } from '../abilities/list/general/patricipating-units'
import { CombatState } from './combat-state'
import {
  addHits,
  assignHits,
  countUnits,
  destroyUnit,
  getUnit,
} from './side-state-ops'
import type { CombatStateData, SideState, Unit } from './types'

// Test faction constant
const TEST_FACTION: FactionKey = 'ARBOREC'

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
      )

      expect(state.attacker.units.FIGHTER).toHaveLength(2)
      expect(state.defender.units.CRUISER).toHaveLength(1)
    })

    it('creates state with empty hit pools', () => {
      const state = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 1) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
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
      )

      const attackerDice = state.collectDice('attacker', 'COMBAT')
      const defenderDice = state.collectDice('defender', 'COMBAT')

      expect(attackerDice).toEqual([[9, 3, 'FIGHTER']])
      expect(defenderDice).toEqual([[7, 2, 'CRUISER']])
    })

    it('collects AFB dice from units with AFB ability', () => {
      const state = new CombatState(
        createSideState({ DESTROYER: createUnits(destroyerStats, 2) }),
        createSideState({}),
      )

      const dice = state.collectDice('attacker', 'AFB')
      expect(dice).toEqual([[9, 4, 'DESTROYER']]) // 2 destroyers * 2 dice each
    })

    it('returns empty array for no matching units', () => {
      const state = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 1) }),
        createSideState({}),
      )

      const dice = state.collectDice('attacker', 'AFB')
      expect(dice).toEqual([])
    })
  })

  describe('produceHits', () => {
    it('creates multiple outcome states', () => {
      const state = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 1) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
      )

      // 1 die at 9+ (20% hit chance)
      const attackerDice: DieValue[] = [[9, 1, 'FIGHTER']]
      const defenderDice: DieValue[] = [[9, 1, 'CRUISER']]

      const results = state.produceHits(attackerDice, defenderDice, 'COMBAT')

      // 4 outcomes: both miss, attacker hits, defender hits, both hit
      expect(results).toHaveLength(4)
    })

    it('assigns attacker hits to defender hit pool', () => {
      const state = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 1) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
      )

      // 1 die at 1+ (100% hit chance)
      const attackerDice: DieValue[] = [[1, 1, 'FIGHTER']]
      const defenderDice: DieValue[] = []

      const results = state.produceHits(attackerDice, defenderDice, 'COMBAT')

      expect(results).toHaveLength(1)
      expect(results[0].state.defender.hitPools[0]?.hits).toBe(1)
      expect(results[0].state.attacker.hitPools).toHaveLength(0)
    })

    it('assigns defender hits to attacker hit pool', () => {
      const state = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 1) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
      )

      const attackerDice: DieValue[] = []
      const defenderDice: DieValue[] = [[1, 1, 'CRUISER']]

      const results = state.produceHits(attackerDice, defenderDice, 'COMBAT')

      expect(results).toHaveLength(1)
      expect(results[0].state.attacker.hitPools[0]?.hits).toBe(1)
      expect(results[0].state.defender.hitPools).toHaveLength(0)
    })

    it('probabilities sum to 1', () => {
      const state = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 2) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
      )

      const attackerDice: DieValue[] = [[9, 2, 'FIGHTER']]
      const defenderDice: DieValue[] = [[7, 1, 'CRUISER']]

      const results = state.produceHits(attackerDice, defenderDice, 'COMBAT')
      const totalProb = results.reduce(
        (sum: number, r) => sum + r.probability,
        0,
      )

      expect(totalProb).toBeCloseTo(1.0)
    })

    it('handles empty dice lists', () => {
      const state = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 1) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
      )

      const results = state.produceHits([], [], 'COMBAT')

      expect(results).toHaveLength(1)
      expect(results[0].probability).toBe(1)
      expect(results[0].state.attacker.hitPools).toHaveLength(0)
      expect(results[0].state.defender.hitPools).toHaveLength(0)
    })

    it('includes hit counts in meta', () => {
      const state = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 1) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
      )

      const attackerDice: DieValue[] = [[1, 1, 'FIGHTER']]
      const defenderDice: DieValue[] = [[1, 1, 'CRUISER']]

      const results = state.produceHits(attackerDice, defenderDice, 'COMBAT')

      expect(results[0].meta).toEqual({ attacker: 1, defender: 1 })
    })
  })

  describe('assignHits', () => {
    it('destroys units based on pending hits for both sides', () => {
      let state: CombatState = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 2) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 2) }),
      )

      state = state.addHitsToSide('attacker', 1, [])
      state = state.addHitsToSide('defender', 1, [])
      state = state.assignHits()

      expect(state.attacker.units.FIGHTER).toHaveLength(1)
      expect(state.defender.units.CRUISER).toHaveLength(1)
    })

    it('respects AFB pool filter (only targets fighters)', () => {
      let state: CombatState = new CombatState(
        createSideState({
          FIGHTER: createUnits(fighterStats, 1),
          CRUISER: createUnits(cruiserStats, 1),
        }),
        createSideState({ FIGHTER: createUnits(fighterStats, 2) }),
      )

      state = state.addHitsToSide('attacker', 2, ['FIGHTER'])
      state = state.addHitsToSide('defender', 1, ['FIGHTER'])
      state = state.assignHits()

      // AFB only targets fighters, so cruiser survives
      expect(state.attacker.units.FIGHTER).toBeUndefined()
      expect(state.attacker.units.CRUISER).toHaveLength(1)
      // Hit pools are cleared after assignHits (remaining hits are lost)
      expect(state.attacker.hitPools).toHaveLength(0)
      // Defender had 2 fighters, 1 hit applied
      expect(state.defender.units.FIGHTER).toHaveLength(1)
    })
  })

  describe('isFinished', () => {
    it('returns true when attacker eliminated', () => {
      const state = new CombatState(
        createSideState({}),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
      )

      expect(state.isFinished()).toBe(true)
    })

    it('returns true when defender eliminated', () => {
      const state = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 1) }),
        createSideState({}),
      )

      expect(state.isFinished()).toBe(true)
    })

    it('returns false when both sides have units', () => {
      const state = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 1) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
      )

      expect(state.isFinished()).toBe(false)
    })
  })

  describe('getHash', () => {
    it('returns same hash for identical states', () => {
      const state1 = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 2) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
      )
      const state2 = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 2) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
      )

      expect(state1.getHash()).toBe(state2.getHash())
    })

    it('returns different hash for different unit counts', () => {
      const state1 = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 2) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
      )
      const state2 = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 1) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
      )

      expect(state1.getHash()).not.toBe(state2.getHash())
    })
  })

  describe('immutability', () => {
    it('addHitsToSide creates new state', () => {
      const state = new CombatState(
        createSideState({ FIGHTER: createUnits(fighterStats, 2) }),
        createSideState({ CRUISER: createUnits(cruiserStats, 1) }),
      )

      const modified = state.addHitsToSide('attacker', 1, [])
      expect(state.attacker.hitPools).toHaveLength(0)
      expect(modified.attacker.hitPools).toHaveLength(1)
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
          attacker: { abilities: [participatingUnits] },
          defender: { abilities: [] },
        },
        'START_OF_ROUND',
        'SPACE', // combatMode
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
          attacker: { abilities: [participatingUnits] },
          defender: { abilities: [] },
        },
        'START_OF_ROUND',
        'GROUND', // combatMode
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

    it('defaults to space units when combatMode is undefined (backward compatibility)', () => {
      const state = new CombatState(
        createSideState({
          CRUISER: createUnits(cruiserStats, 2),
          INFANTRY: createUnits(infantryStats, 4),
        }),
        createSideState({}),
        {
          attacker: { abilities: [participatingUnits] },
          defender: { abilities: [] },
        },
        'START_OF_ROUND',
        // combatMode is undefined
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
          attacker: { abilities: [participatingUnits] },
          defender: { abilities: [] },
        },
        'START_OF_ROUND',
        'GROUND', // Ground combat mode
      )

      const dice = state.collectDice('attacker', 'COMBAT')

      // Should only collect dice from ground forces (infantry)
      // Infantry has COMBAT: [8, 1], so 4 infantry = [[8, 4, 'INFANTRY']]
      expect(dice).toHaveLength(1)
      expect(dice[0]).toEqual([8, 4, 'INFANTRY'])

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
          attacker: { abilities: [participatingUnits] },
          defender: { abilities: [] },
        },
        'START_OF_ROUND',
        'SPACE', // Space combat mode
      )

      const dice = state.collectDice('attacker', 'COMBAT')

      // Should only collect dice from ships (cruisers)
      // Cruiser has COMBAT: [7, 1], so 2 cruisers = [[7, 2, 'CRUISER']]
      expect(dice).toHaveLength(1)
      expect(dice[0]).toEqual([7, 2, 'CRUISER'])

      // Infantry should NOT contribute dice (they are not participating in space combat)
    })
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
      abilities: { attacker: { abilities: [] }, defender: { abilities: [] } },
      phase: 'START_OF_ROUND',
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
