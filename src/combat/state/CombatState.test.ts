import { describe, it, expect } from 'vitest'
import { CombatState } from './CombatState'
import { CombatSideState } from './CombatSideState'
import type { UnitStats, DieValue } from '@/types'

describe('CombatState', () => {
  const fighterStats: UnitStats = { COMBAT: [9, 1], ABILITIES: {} }
  const cruiserStats: UnitStats = { COMBAT: [7, 1], ABILITIES: {} }
  const destroyerStats: UnitStats = {
    COMBAT: [9, 1],
    ABILITIES: { AFB: [9, 2] },
  }

  describe('create', () => {
    it('creates initial state with unit counts', () => {
      const state = CombatState.create(
        { FIGHTER: fighterStats },
        { FIGHTER: 2 },
        { CRUISER: cruiserStats },
        { CRUISER: 1 },
      )

      expect(state.attacker.units.FIGHTER).toHaveLength(2)
      expect(state.defender.units.CRUISER).toHaveLength(1)
    })

    it('ignores zero counts', () => {
      const state = CombatState.create(
        { FIGHTER: fighterStats },
        { FIGHTER: 0 },
        { CRUISER: cruiserStats },
        { CRUISER: 1 },
      )

      expect(state.attacker.units.FIGHTER).toBeUndefined()
    })

    it('creates state with empty hit pools', () => {
      const state = CombatState.create(
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
        { CRUISER: cruiserStats },
        { CRUISER: 1 },
      )

      expect(state.attacker.pendingHits).toBe(0)
      expect(state.defender.pendingHits).toBe(0)
    })
  })

  describe('collectDice', () => {
    it('collects combat dice from units', () => {
      const state = CombatState.create(
        { FIGHTER: fighterStats },
        { FIGHTER: 3 },
        { CRUISER: cruiserStats },
        { CRUISER: 2 },
      )

      const attackerDice = state.collectDice('attacker', 'COMBAT')
      const defenderDice = state.collectDice('defender', 'COMBAT')

      expect(attackerDice).toEqual([[9, 3]])
      expect(defenderDice).toEqual([[7, 2]])
    })

    it('collects AFB dice from units with AFB ability', () => {
      const state = CombatState.create(
        { DESTROYER: destroyerStats },
        { DESTROYER: 2 },
        {},
        {},
      )

      const dice = state.collectDice('attacker', 'AFB')
      expect(dice).toEqual([[9, 4]]) // 2 destroyers * 2 dice each
    })

    it('returns empty array for no matching units', () => {
      const state = CombatState.create(
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
        {},
        {},
      )

      const dice = state.collectDice('attacker', 'AFB')
      expect(dice).toEqual([])
    })
  })

  describe('produceHits', () => {
    it('creates multiple outcome states', () => {
      const state = CombatState.create(
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
        { CRUISER: cruiserStats },
        { CRUISER: 1 },
      )

      // 1 die at 9+ (20% hit chance)
      const attackerDice: DieValue[] = [[9, 1]]
      const defenderDice: DieValue[] = [[9, 1]]

      const results = state.produceHits(attackerDice, defenderDice, 'COMBAT')

      // 4 outcomes: both miss, attacker hits, defender hits, both hit
      expect(results).toHaveLength(4)
    })

    it('assigns attacker hits to defender hit pool', () => {
      const state = CombatState.create(
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
        { CRUISER: cruiserStats },
        { CRUISER: 1 },
      )

      // 1 die at 1+ (100% hit chance)
      const attackerDice: DieValue[] = [[1, 1]]
      const defenderDice: DieValue[] = []

      const results = state.produceHits(attackerDice, defenderDice, 'COMBAT')

      expect(results).toHaveLength(1)
      expect(results[0].state.defender.pendingHits).toBe(1)
      expect(results[0].state.attacker.pendingHits).toBe(0)
    })

    it('assigns defender hits to attacker hit pool', () => {
      const state = CombatState.create(
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
        { CRUISER: cruiserStats },
        { CRUISER: 1 },
      )

      const attackerDice: DieValue[] = []
      const defenderDice: DieValue[] = [[1, 1]]

      const results = state.produceHits(attackerDice, defenderDice, 'COMBAT')

      expect(results).toHaveLength(1)
      expect(results[0].state.attacker.pendingHits).toBe(1)
      expect(results[0].state.defender.pendingHits).toBe(0)
    })

    it('probabilities sum to 1', () => {
      const state = CombatState.create(
        { FIGHTER: fighterStats },
        { FIGHTER: 2 },
        { CRUISER: cruiserStats },
        { CRUISER: 1 },
      )

      const attackerDice: DieValue[] = [[9, 2]]
      const defenderDice: DieValue[] = [[7, 1]]

      const results = state.produceHits(attackerDice, defenderDice, 'COMBAT')
      const totalProb = results.reduce((sum, r) => sum + r.probability, 0)

      expect(totalProb).toBeCloseTo(1.0)
    })

    it('handles empty dice lists', () => {
      const state = CombatState.create(
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
        { CRUISER: cruiserStats },
        { CRUISER: 1 },
      )

      const results = state.produceHits([], [], 'COMBAT')

      expect(results).toHaveLength(1)
      expect(results[0].probability).toBe(1)
      expect(results[0].state.attacker.pendingHits).toBe(0)
      expect(results[0].state.defender.pendingHits).toBe(0)
    })

    it('includes hit counts in meta', () => {
      const state = CombatState.create(
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
        { CRUISER: cruiserStats },
        { CRUISER: 1 },
      )

      const attackerDice: DieValue[] = [[1, 1]]
      const defenderDice: DieValue[] = [[1, 1]]

      const results = state.produceHits(attackerDice, defenderDice, 'COMBAT')

      expect(results[0].meta).toEqual({ attacker: 1, defender: 1 })
    })
  })

  describe('assignHits', () => {
    it('destroys units based on pending hits for both sides', () => {
      let state = CombatState.create(
        { FIGHTER: fighterStats },
        { FIGHTER: 2 },
        { CRUISER: cruiserStats },
        { CRUISER: 2 },
      )

      state = state.addHitsToSide('attacker', 'COMBAT', 1)
      state = state.addHitsToSide('defender', 'COMBAT', 1)
      state = state.assignHits()

      expect(state.attacker.units.FIGHTER).toHaveLength(1)
      expect(state.defender.units.CRUISER).toHaveLength(1)
    })

    it('respects AFB pool filter (only targets fighters)', () => {
      let state = CombatState.create(
        { FIGHTER: fighterStats, CRUISER: cruiserStats },
        { FIGHTER: 1, CRUISER: 1 },
        { FIGHTER: fighterStats },
        { FIGHTER: 2 },
      )

      state = state.addHitsToSide('attacker', 'AFB', 2)
      state = state.addHitsToSide('defender', 'AFB', 1)
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
      const state = CombatState.create(
        { FIGHTER: fighterStats },
        {},
        { CRUISER: cruiserStats },
        { CRUISER: 1 },
      )

      expect(state.isFinished()).toBe(true)
    })

    it('returns true when defender eliminated', () => {
      const state = CombatState.create(
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
        { CRUISER: cruiserStats },
        {},
      )

      expect(state.isFinished()).toBe(true)
    })

    it('returns false when both sides have units', () => {
      const state = CombatState.create(
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
        { CRUISER: cruiserStats },
        { CRUISER: 1 },
      )

      expect(state.isFinished()).toBe(false)
    })
  })

  describe('getHash', () => {
    it('returns same hash for identical states', () => {
      const state1 = CombatState.create(
        { FIGHTER: fighterStats },
        { FIGHTER: 2 },
        { CRUISER: cruiserStats },
        { CRUISER: 1 },
      )
      const state2 = CombatState.create(
        { FIGHTER: fighterStats },
        { FIGHTER: 2 },
        { CRUISER: cruiserStats },
        { CRUISER: 1 },
      )

      expect(state1.getHash()).toBe(state2.getHash())
    })

    it('returns different hash for different unit counts', () => {
      const state1 = CombatState.create(
        { FIGHTER: fighterStats },
        { FIGHTER: 2 },
        { CRUISER: cruiserStats },
        { CRUISER: 1 },
      )
      const state2 = CombatState.create(
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
        { CRUISER: cruiserStats },
        { CRUISER: 1 },
      )

      expect(state1.getHash()).not.toBe(state2.getHash())
    })
  })

  describe('clone', () => {
    it('creates independent copy', () => {
      const state = CombatState.create(
        { FIGHTER: fighterStats },
        { FIGHTER: 2 },
        { CRUISER: cruiserStats },
        { CRUISER: 1 },
      )

      const clone = state.clone()

      // Clone has same hash
      expect(clone.getHash()).toBe(state.getHash())

      // But modifying clone doesn't affect original
      const modified = clone.addHitsToSide('attacker', 'COMBAT', 1)
      expect(state.attacker.pendingHits).toBe(0)
      expect(modified.attacker.pendingHits).toBe(1)
    })
  })
})

describe('CombatSideState', () => {
  const fighterStats: UnitStats = { COMBAT: [9, 1], ABILITIES: {} }
  const cruiserStats: UnitStats = { COMBAT: [7, 1], ABILITIES: {} }

  describe('addHits', () => {
    it('returns same instance for zero hits', () => {
      const side = new CombatSideState(
        { FIGHTER: fighterStats },
        { FIGHTER: [{}] },
      )
      const result = side.addHits('COMBAT', 0)
      expect(result).toBe(side)
    })

    it('adds hits to pool', () => {
      const side = new CombatSideState(
        { FIGHTER: fighterStats },
        { FIGHTER: [{}] },
      )
      const result = side.addHits('COMBAT', 2)
      expect(result.pendingHits).toBe(2)
    })
  })

  describe('assignHits', () => {
    it('destroys cheapest units first', () => {
      const side = new CombatSideState(
        { FIGHTER: fighterStats, CRUISER: cruiserStats },
        { FIGHTER: [{}, {}], CRUISER: [{}, {}] },
      )
      const withHits = side.addHits('COMBAT', 2)
      const result = withHits.assignHits()

      expect(result.units.FIGHTER).toBeUndefined()
      expect(result.units.CRUISER).toHaveLength(2)
    })

    it('preserves stats reference', () => {
      const stats = { FIGHTER: fighterStats }
      const side = new CombatSideState(stats, { FIGHTER: [{}, {}] })
      const withHits = side.addHits('COMBAT', 1)
      const result = withHits.assignHits()

      expect(result.stats).toBe(stats)
    })
  })

  describe('countUnits', () => {
    it('counts total units across all types', () => {
      const side = new CombatSideState(
        { FIGHTER: fighterStats, CRUISER: cruiserStats },
        { FIGHTER: [{}, {}], CRUISER: [{}] },
      )
      expect(side.countUnits()).toBe(3)
    })

    it('returns 0 for empty state', () => {
      const side = new CombatSideState({}, {})
      expect(side.countUnits()).toBe(0)
    })
  })
})
