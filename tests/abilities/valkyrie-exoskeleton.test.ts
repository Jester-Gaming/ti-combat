import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('VALKYRIE_EXOSKELETON', () => {
  it.forEachSide(
    'produces 1 hit when mech sustains during ground combat',
    () => {
      const t = combatTest({
        mode: 'GROUND',
        attacker: {
          faction: 'SARDAKK_NORR',
          units: { MECH: 1, INFANTRY: 1 },
        },
        defender: {
          faction: 'ARBOREC',
          units: { INFANTRY: 2 },
        },
      })

      t.advanceTo('GROUND_COMBAT')
      t.advanceRound({ attacker: 1 })

      // Mech sustains the hit, then Valkyrie Exoskeleton produces 1 hit
      expect(t.attacker.units.MECH).toHaveLength(1)
      expect(t.attacker.units.MECH![0].isDamaged).toBe(true)

      // 1 hit from Valkyrie Exoskeleton destroys 1 infantry
      expect(t.defender.units.INFANTRY).toHaveLength(1)
    },
  )

  it.forEachSide('fires for each mech that sustains', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { MECH: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 2 })

    // Both mechs sustain, each produces 1 hit
    expect(t.attacker.units.MECH).toHaveLength(2)
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
    expect(t.attacker.units.MECH![1].isDamaged).toBe(true)

    // 2 hits from Valkyrie Exoskeleton destroy 2 infantry
    expect(t.defender.units.INFANTRY).toHaveLength(1)
  })

  it('does not produce a hit when a unit sustains during bombardment', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, INFANTRY: 2 },
      },
      defender: {
        faction: 'SARDAKK_NORR',
        units: { MECH: 1, INFANTRY: 1 },
      },
    })

    // Bombardment: Arborec dreadnought [5, 1] scores 1 hit on the planet;
    // the Sardakk mech sustains it before ground combat begins.
    t.advanceTo('GROUND_COMBAT', { defender: 1 })

    // Mech actually sustained the bombardment hit
    expect(t.defender.units.MECH![0].isDamaged).toBe(true)
    // Valkyrie Exoskeleton must NOT fire outside of ground combat
    expect(t.abilityLog('VALKYRIE_EXOSKELETON')).toHaveLength(0)
    // No Exoskeleton hit produced against the opponent's ground forces
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })

  it('does not produce a hit when a unit sustains during space cannon defense', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { MECH: 1, INFANTRY: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 1 },
      },
    })

    // Space Cannon Defense: Arborec PDS [6, 1] scores 1 hit on the invading
    // ground forces; the Sardakk mech sustains it before ground combat begins.
    t.advanceTo('GROUND_COMBAT', { attacker: 1 })

    // Mech actually sustained the space cannon hit
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
    // Valkyrie Exoskeleton must NOT fire outside of ground combat
    expect(t.abilityLog('VALKYRIE_EXOSKELETON')).toHaveLength(0)
    // No Exoskeleton hit produced against the opponent's ground forces
    expect(t.defender.units.INFANTRY).toHaveLength(1)
  })
})
