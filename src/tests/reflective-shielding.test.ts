import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('REFLECTIVE_SHIELDING', () => {
  it('produces 2 hits when own ship sustains', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: { REFLECTIVE_SHIELDING: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    // Dreadnought sustains, Reflective Shielding produces 2 hits against opponent
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)

    // 2 hits destroy 2 cruisers
    expect(t.defender.units.CRUISER).toBeUndefined()
  })

  it('consumes one use per combat (2 sustains, 1 use = only 2 hits)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2 },
        abilities: { REFLECTIVE_SHIELDING: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 2 })

    // Both dreadnoughts sustain, but only first triggers Reflective Shielding
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(2)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.attacker.units.DREADNOUGHT![1].isDamaged).toBe(true)

    // Only 2 hits produced (not 4) — 1 cruiser survives
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })

  it('does not fire during ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { MECH: 1 },
        abilities: { REFLECTIVE_SHIELDING: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    // Mech sustains
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)

    // No hits produced — infantry survive (RS context is SPACE)
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })

  it('does not fire when no sustain occurs (fighter destroyed)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { FIGHTER: 1 },
        abilities: { REFLECTIVE_SHIELDING: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    // Fighter can't sustain — no trigger
    expect(t.attacker.units.FIGHTER).toBeUndefined()
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })
})
