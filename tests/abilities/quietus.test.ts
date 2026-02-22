import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('QUIETUS', () => {
  describe('environment (no Crimson player)', () => {
    it('disables sustain for both sides', () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: {
          faction: 'ARBOREC',
          units: { DREADNOUGHT: 1 },
          abilities: { QUIETUS: true },
        },
        defender: {
          faction: 'ARBOREC',
          units: { DREADNOUGHT: 1 },
          abilities: { QUIETUS: true },
        },
      })

      t.advanceTo('SPACE_COMBAT', 'START')
      t.advanceRound({ attacker: 1, defender: 1 })

      // Neither dreadnought sustained — both destroyed
      expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
      expect(t.defender.units.DREADNOUGHT).toBeUndefined()
    })

    it('disables bombardment', () => {
      const t = combatTest({
        mode: 'GROUND',
        attacker: {
          faction: 'ARBOREC',
          units: { DREADNOUGHT: 1, INFANTRY: 1 },
          abilities: { QUIETUS: true },
        },
        defender: {
          faction: 'ARBOREC',
          units: { INFANTRY: 1 },
          abilities: { QUIETUS: true },
        },
      })

      t.advanceTo('SPACE_CANNON_DEFENSE')
      const pool = t.dicePool()

      // No bombardment dice
      expect(pool?.attacker?.DREADNOUGHT).toBeUndefined()
    })
  })

  describe('environment (Crimson side)', () => {
    it('does not disable sustain for Crimson attacker', () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: {
          faction: 'CRIMSON_REBELLION',
          units: { DREADNOUGHT: 1 },
          abilities: { QUIETUS: true },
        },
        defender: {
          faction: 'ARBOREC',
          units: { DREADNOUGHT: 1 },
          abilities: { QUIETUS: true },
        },
      })

      t.advanceTo('SPACE_COMBAT', 'START')
      t.advanceRound({ attacker: 1, defender: 1 })

      // Crimson dreadnought sustained
      expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
      expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)

      // Opponent dreadnought could not sustain — destroyed
      expect(t.defender.units.DREADNOUGHT).toBeUndefined()
    })

    it('does not disable sustain for Crimson defender', () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: {
          faction: 'ARBOREC',
          units: { DREADNOUGHT: 1 },
          abilities: { QUIETUS: true },
        },
        defender: {
          faction: 'CRIMSON_REBELLION',
          units: { DREADNOUGHT: 1 },
          abilities: { QUIETUS: true },
        },
      })

      t.advanceTo('SPACE_COMBAT', 'START')
      t.advanceRound({ attacker: 1, defender: 1 })

      // Attacker dreadnought could not sustain — destroyed
      expect(t.attacker.units.DREADNOUGHT).toBeUndefined()

      // Crimson dreadnought sustained
      expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
      expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
    })
  })

  describe('flagship AFTER_DESTROY', () => {
    it('restores opponent abilities when Crimson flagship is destroyed', () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: {
          faction: 'CRIMSON_REBELLION',
          units: { FLAGSHIP: 1, WAR_SUN: 1 },
          abilities: { QUIETUS: true },
        },
        defender: {
          faction: 'ARBOREC',
          units: { DREADNOUGHT: 1, CRUISER: 3 },
          abilities: { QUIETUS: true },
        },
      })

      t.advanceTo('SPACE_COMBAT', 'START')

      // Round 1: 3 hits to attacker — flagship sustains 1, war_sun sustains 1,
      // remaining hit destroys flagship (cost 8, cheaper than war_sun 12)
      t.advanceRound({ attacker: 3 })

      expect(t.attacker.units.FLAGSHIP).toBeUndefined()
      expect(t.attacker.units.WAR_SUN).toHaveLength(1)

      // Round 2: defender dreadnought can now sustain (restrictions removed)
      t.advanceRound({ defender: 1 })

      expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
      expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
    })

    it('keeps abilities disabled when flagship is not in combat', () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: {
          faction: 'ARBOREC',
          units: { DREADNOUGHT: 1 },
          abilities: { QUIETUS: true },
        },
        defender: {
          faction: 'ARBOREC',
          units: { DREADNOUGHT: 1 },
          abilities: { QUIETUS: true },
        },
      })

      t.advanceTo('SPACE_COMBAT', 'START')
      t.advanceRound({ attacker: 1, defender: 1 })

      // Both dreadnoughts destroyed (no sustain, no flagship to restore)
      expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
      expect(t.defender.units.DREADNOUGHT).toBeUndefined()
    })
  })
})
