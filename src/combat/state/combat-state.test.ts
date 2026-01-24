import { describe, expect, it } from 'vitest'

import type { DieValue, FactionKey } from '@/types'

import type { Unit } from './combat-side-state'
import { CombatSideState } from './combat-side-state'
import { CombatState } from './combat-state'

// Test faction constant
const TEST_FACTION: FactionKey = 'ARBOREC'

// Helper to create units with stats
function createUnits(stats: Partial<Unit>, count: number): Unit[] {
  return Array.from({ length: count }, () => ({ ...stats }))
}

describe('CombatState', () => {
  const fighterStats: Partial<Unit> = { COMBAT: [9, 1], ABILITIES: {} }
  const cruiserStats: Partial<Unit> = { COMBAT: [7, 1], ABILITIES: {} }
  const destroyerStats: Partial<Unit> = {
    COMBAT: [9, 1],
    ABILITIES: { AFB: [9, 2] },
  }

  describe('constructor', () => {
    it('creates state with unit counts', () => {
      const state = new CombatState(
        new CombatSideState(TEST_FACTION, {
          FIGHTER: createUnits(fighterStats, 2),
        }),
        new CombatSideState(TEST_FACTION, {
          CRUISER: createUnits(cruiserStats, 1),
        }),
      )

      expect(state.attacker.units.FIGHTER).toHaveLength(2)
      expect(state.defender.units.CRUISER).toHaveLength(1)
    })

    it('creates state with empty hit pools', () => {
      const state = new CombatState(
        new CombatSideState(TEST_FACTION, {
          FIGHTER: createUnits(fighterStats, 1),
        }),
        new CombatSideState(TEST_FACTION, {
          CRUISER: createUnits(cruiserStats, 1),
        }),
      )

      expect(state.attacker.pendingHits).toBe(0)
      expect(state.defender.pendingHits).toBe(0)
    })
  })

  describe('collectDice', () => {
    it('collects combat dice from units', () => {
      const state = new CombatState(
        new CombatSideState(TEST_FACTION, {
          FIGHTER: createUnits(fighterStats, 3),
        }),
        new CombatSideState(TEST_FACTION, {
          CRUISER: createUnits(cruiserStats, 2),
        }),
      )

      const attackerDice = state.collectDice('attacker', 'COMBAT')
      const defenderDice = state.collectDice('defender', 'COMBAT')

      expect(attackerDice).toEqual([[9, 3, 'FIGHTER']])
      expect(defenderDice).toEqual([[7, 2, 'CRUISER']])
    })

    it('collects AFB dice from units with AFB ability', () => {
      const state = new CombatState(
        new CombatSideState(TEST_FACTION, {
          DESTROYER: createUnits(destroyerStats, 2),
        }),
        new CombatSideState(TEST_FACTION, {}),
      )

      const dice = state.collectDice('attacker', 'AFB')
      expect(dice).toEqual([[9, 4, 'DESTROYER']]) // 2 destroyers * 2 dice each
    })

    it('returns empty array for no matching units', () => {
      const state = new CombatState(
        new CombatSideState(TEST_FACTION, {
          FIGHTER: createUnits(fighterStats, 1),
        }),
        new CombatSideState(TEST_FACTION, {}),
      )

      const dice = state.collectDice('attacker', 'AFB')
      expect(dice).toEqual([])
    })
  })

  describe('produceHits', () => {
    it('creates multiple outcome states', () => {
      const state = new CombatState(
        new CombatSideState(TEST_FACTION, {
          FIGHTER: createUnits(fighterStats, 1),
        }),
        new CombatSideState(TEST_FACTION, {
          CRUISER: createUnits(cruiserStats, 1),
        }),
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
        new CombatSideState(TEST_FACTION, {
          FIGHTER: createUnits(fighterStats, 1),
        }),
        new CombatSideState(TEST_FACTION, {
          CRUISER: createUnits(cruiserStats, 1),
        }),
      )

      // 1 die at 1+ (100% hit chance)
      const attackerDice: DieValue[] = [[1, 1, 'FIGHTER']]
      const defenderDice: DieValue[] = []

      const results = state.produceHits(attackerDice, defenderDice, 'COMBAT')

      expect(results).toHaveLength(1)
      expect(results[0].state.defender.pendingHits).toBe(1)
      expect(results[0].state.attacker.pendingHits).toBe(0)
    })

    it('assigns defender hits to attacker hit pool', () => {
      const state = new CombatState(
        new CombatSideState(TEST_FACTION, {
          FIGHTER: createUnits(fighterStats, 1),
        }),
        new CombatSideState(TEST_FACTION, {
          CRUISER: createUnits(cruiserStats, 1),
        }),
      )

      const attackerDice: DieValue[] = []
      const defenderDice: DieValue[] = [[1, 1, 'CRUISER']]

      const results = state.produceHits(attackerDice, defenderDice, 'COMBAT')

      expect(results).toHaveLength(1)
      expect(results[0].state.attacker.pendingHits).toBe(1)
      expect(results[0].state.defender.pendingHits).toBe(0)
    })

    it('probabilities sum to 1', () => {
      const state = new CombatState(
        new CombatSideState(TEST_FACTION, {
          FIGHTER: createUnits(fighterStats, 2),
        }),
        new CombatSideState(TEST_FACTION, {
          CRUISER: createUnits(cruiserStats, 1),
        }),
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
        new CombatSideState(TEST_FACTION, {
          FIGHTER: createUnits(fighterStats, 1),
        }),
        new CombatSideState(TEST_FACTION, {
          CRUISER: createUnits(cruiserStats, 1),
        }),
      )

      const results = state.produceHits([], [], 'COMBAT')

      expect(results).toHaveLength(1)
      expect(results[0].probability).toBe(1)
      expect(results[0].state.attacker.pendingHits).toBe(0)
      expect(results[0].state.defender.pendingHits).toBe(0)
    })

    it('includes hit counts in meta', () => {
      const state = new CombatState(
        new CombatSideState(TEST_FACTION, {
          FIGHTER: createUnits(fighterStats, 1),
        }),
        new CombatSideState(TEST_FACTION, {
          CRUISER: createUnits(cruiserStats, 1),
        }),
      )

      const attackerDice: DieValue[] = [[1, 1, 'FIGHTER']]
      const defenderDice: DieValue[] = [[1, 1, 'CRUISER']]

      const results = state.produceHits(attackerDice, defenderDice, 'COMBAT')

      expect(results[0].meta).toEqual({ attacker: 1, defender: 1 })
    })
  })

  describe('assignHits', () => {
    it('destroys units based on pending hits for both sides', () => {
      let state = new CombatState(
        new CombatSideState(TEST_FACTION, {
          FIGHTER: createUnits(fighterStats, 2),
        }),
        new CombatSideState(TEST_FACTION, {
          CRUISER: createUnits(cruiserStats, 2),
        }),
      )

      state = state.addHitsToSide('attacker', 1, [])
      state = state.addHitsToSide('defender', 1, [])
      state = state.assignHits()

      expect(state.attacker.units.FIGHTER).toHaveLength(1)
      expect(state.defender.units.CRUISER).toHaveLength(1)
    })

    it('respects AFB pool filter (only targets fighters)', () => {
      let state = new CombatState(
        new CombatSideState(TEST_FACTION, {
          FIGHTER: createUnits(fighterStats, 1),
          CRUISER: createUnits(cruiserStats, 1),
        }),
        new CombatSideState(TEST_FACTION, {
          FIGHTER: createUnits(fighterStats, 2),
        }),
      )

      state = state.addHitsToSide('attacker', 2, ['FIGHTER'])
      state = state.addHitsToSide('defender', 1, ['FIGHTER'])
      state = state.assignHits()

      // AFB only targets fighters, so cruiser survives
      expect(state.attacker.units.FIGHTER).toBeUndefined()
      expect(state.attacker.units.CRUISER).toHaveLength(1)
      // Hit pools are cleared after assignHits (remaining hits are lost)
      expect(state.attacker.pendingHits).toBe(0)
      // Defender had 2 fighters, 1 hit applied
      expect(state.defender.units.FIGHTER).toHaveLength(1)
    })
  })

  describe('isFinished', () => {
    it('returns true when attacker eliminated', () => {
      const state = new CombatState(
        new CombatSideState(TEST_FACTION, {}),
        new CombatSideState(TEST_FACTION, {
          CRUISER: createUnits(cruiserStats, 1),
        }),
      )

      expect(state.isFinished()).toBe(true)
    })

    it('returns true when defender eliminated', () => {
      const state = new CombatState(
        new CombatSideState(TEST_FACTION, {
          FIGHTER: createUnits(fighterStats, 1),
        }),
        new CombatSideState(TEST_FACTION, {}),
      )

      expect(state.isFinished()).toBe(true)
    })

    it('returns false when both sides have units', () => {
      const state = new CombatState(
        new CombatSideState(TEST_FACTION, {
          FIGHTER: createUnits(fighterStats, 1),
        }),
        new CombatSideState(TEST_FACTION, {
          CRUISER: createUnits(cruiserStats, 1),
        }),
      )

      expect(state.isFinished()).toBe(false)
    })
  })

  describe('getHash', () => {
    it('returns same hash for identical states', () => {
      const state1 = new CombatState(
        new CombatSideState(TEST_FACTION, {
          FIGHTER: createUnits(fighterStats, 2),
        }),
        new CombatSideState(TEST_FACTION, {
          CRUISER: createUnits(cruiserStats, 1),
        }),
      )
      const state2 = new CombatState(
        new CombatSideState(TEST_FACTION, {
          FIGHTER: createUnits(fighterStats, 2),
        }),
        new CombatSideState(TEST_FACTION, {
          CRUISER: createUnits(cruiserStats, 1),
        }),
      )

      expect(state1.getHash()).toBe(state2.getHash())
    })

    it('returns different hash for different unit counts', () => {
      const state1 = new CombatState(
        new CombatSideState(TEST_FACTION, {
          FIGHTER: createUnits(fighterStats, 2),
        }),
        new CombatSideState(TEST_FACTION, {
          CRUISER: createUnits(cruiserStats, 1),
        }),
      )
      const state2 = new CombatState(
        new CombatSideState(TEST_FACTION, {
          FIGHTER: createUnits(fighterStats, 1),
        }),
        new CombatSideState(TEST_FACTION, {
          CRUISER: createUnits(cruiserStats, 1),
        }),
      )

      expect(state1.getHash()).not.toBe(state2.getHash())
    })
  })

  describe('clone', () => {
    it('creates independent copy', () => {
      const state = new CombatState(
        new CombatSideState(TEST_FACTION, {
          FIGHTER: createUnits(fighterStats, 2),
        }),
        new CombatSideState(TEST_FACTION, {
          CRUISER: createUnits(cruiserStats, 1),
        }),
      )

      const clone = state.clone()

      // Clone has same hash
      expect(clone.getHash()).toBe(state.getHash())

      // But modifying clone doesn't affect original
      const modified = clone.addHitsToSide('attacker', 1, [])
      expect(state.attacker.pendingHits).toBe(0)
      expect(modified.attacker.pendingHits).toBe(1)
    })
  })
})

describe('CombatSideState', () => {
  const fighterStats: Partial<Unit> = { COMBAT: [9, 1], ABILITIES: {} }
  const cruiserStats: Partial<Unit> = { COMBAT: [7, 1], ABILITIES: {} }

  describe('addHits', () => {
    it('returns same instance for zero hits', () => {
      const side = new CombatSideState(TEST_FACTION, {
        FIGHTER: [{ ...fighterStats }],
      })
      const result = side.addHits(0, [])
      expect(result).toBe(side)
    })

    it('adds hits to pool', () => {
      const side = new CombatSideState(TEST_FACTION, {
        FIGHTER: [{ ...fighterStats }],
      })
      const result = side.addHits(2, [])
      expect(result.pendingHits).toBe(2)
    })
  })

  describe('assignHits', () => {
    it('destroys cheapest units first', () => {
      const side = new CombatSideState(TEST_FACTION, {
        FIGHTER: [{ ...fighterStats }, { ...fighterStats }],
        CRUISER: [{ ...cruiserStats }, { ...cruiserStats }],
      })
      const participating = new Set(['FIGHTER', 'CRUISER'] as const)
      const withHits = side.addHits(2, [])
      const result = withHits.assignHits(participating)

      expect(result.units.FIGHTER).toBeUndefined()
      expect(result.units.CRUISER).toHaveLength(2)
    })
  })

  describe('countUnits', () => {
    it('counts total units across all types', () => {
      const side = new CombatSideState(TEST_FACTION, {
        FIGHTER: [{ ...fighterStats }, { ...fighterStats }],
        CRUISER: [{ ...cruiserStats }],
      })
      expect(side.countUnits()).toBe(3)
    })

    it('returns 0 for empty state', () => {
      const side = new CombatSideState(TEST_FACTION, {})
      expect(side.countUnits()).toBe(0)
    })
  })

  describe('getUnit', () => {
    it('finds unit matching predicate', () => {
      const side = new CombatSideState(TEST_FACTION, {
        FIGHTER: [
          { ...fighterStats, isDamaged: true },
          { ...fighterStats, isDamaged: false },
        ],
      })

      const undamaged = side.getUnit('FIGHTER', { isDamaged: false })
      expect(undamaged).toBeDefined()
      expect(undamaged?.isDamaged).toBe(false)
    })

    it('returns undefined when no match', () => {
      const side = new CombatSideState(TEST_FACTION, {
        FIGHTER: [{ ...fighterStats, isDamaged: true }],
      })

      const undamaged = side.getUnit('FIGHTER', { isDamaged: false })
      expect(undamaged).toBeUndefined()
    })
  })

  describe('destroyUnit', () => {
    it('removes specific unit', () => {
      const unit1 = { ...fighterStats }
      const unit2 = { ...fighterStats }
      const side = new CombatSideState(TEST_FACTION, {
        FIGHTER: [unit1, unit2],
      })

      const result = side.destroyUnit('FIGHTER', unit1)
      expect(result.units.FIGHTER).toHaveLength(1)
      expect(result.units.FIGHTER?.[0]).toBe(unit2)
    })

    it('removes unit type when last unit destroyed', () => {
      const unit = { ...fighterStats }
      const side = new CombatSideState(TEST_FACTION, {
        FIGHTER: [unit],
      })

      const result = side.destroyUnit('FIGHTER', unit)
      expect(result.units.FIGHTER).toBeUndefined()
    })
  })
})
