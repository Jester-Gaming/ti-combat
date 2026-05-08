import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DIRECT_HIT', () => {
  it('destroys opponent ship that used sustain damage', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    // Dreadnought sustained then was destroyed by Direct Hit
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
  })

  it('multiple uses destroy multiple ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { DIRECT_HIT: { uses: 2 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 2 })

    // Both dreadnoughts sustained and were destroyed
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
  })

  it('does not fire when no sustain occurs', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { FIGHTER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    // Fighter can't sustain — Direct Hit doesn't trigger, fighter destroyed
    expect(t.defender.units.FIGHTER).toBeUndefined()
  })

  it('does not destroy upgraded L1Z1X Dreadnought (immune)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
      defender: {
        faction: 'L1Z1X_MINDNET',
        units: { DREADNOUGHT: 1 },
        upgrades: ['DREADNOUGHT'],
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    // Upgraded L1Z1X Dreadnought sustains normally — immune to Direct Hit
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })

  it('does not consume uses on immune units', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
      defender: {
        faction: 'L1Z1X_MINDNET',
        units: { DREADNOUGHT: 1 },
        upgrades: ['DREADNOUGHT'],
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    // Uses should remain at 1 — not consumed on immune unit
    expect(t.state.attacker.abilities.DIRECT_HIT.uses).toBe(1)
  })

  it('does not destroy upgraded Sardakk Dreadnought (immune)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
      defender: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 1 },
        upgrades: ['DREADNOUGHT'],
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    // Upgraded Sardakk Dreadnought sustains normally — immune to Direct Hit
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })

  it('both sides can have Direct Hit independently', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1, defender: 1 })

    // Both dreadnoughts sustained and were destroyed by opponent's Direct Hit
    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
  })

  it('does not trigger when sustaining variant is excluded from targets', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { DIRECT_HIT: { uses: 1, targets: [['CRUISER', true]] } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.state.attacker.abilities.DIRECT_HIT.uses).toBe(1)
  })

  it('fires only on variants present in targets', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          DIRECT_HIT: { uses: 2, targets: [['DREADNOUGHT', true]] },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, WAR_SUN: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 2 })

    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
    expect(t.defender.units.WAR_SUN).toHaveLength(1)
    expect(t.defender.units.WAR_SUN![0].isDamaged).toBe(true)
    expect(t.state.attacker.abilities.DIRECT_HIT.uses).toBe(1)
  })
})
