import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('EXOTRIREME', () => {
  it('sacrifices the dreadnought and destroys up to 2 opponent ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        upgrades: ['DREADNOUGHT'],
        abilities: { EXOTRIREME: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.abilityLog('EXOTRIREME')).not.toHaveLength(0)
  })

  it('destroys only 1 ship when only 1 target remains', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        upgrades: ['DREADNOUGHT'],
        abilities: { EXOTRIREME: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    expect(t.defender.units.CRUISER).toBeUndefined()
    expect(t.abilityLog('EXOTRIREME')).not.toHaveLength(0)
  })

  it('does not fire when no valid targets remain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        upgrades: ['DREADNOUGHT'],
        abilities: { EXOTRIREME: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    // Defender cruiser dies in round 1 from combat hits → no targets at round end
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    // Defender is wiped; Exotrireme II cannot fire because nothing to target
    expect(t.defender.units.CRUISER).toBeUndefined()
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.abilityLog('EXOTRIREME')).toHaveLength(0)
  })

  it('fires once per Exotrireme II dreadnought', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 2, CRUISER: 1 },
        upgrades: ['DREADNOUGHT'],
        abilities: { EXOTRIREME: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 5 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // Both dreadnoughts sacrifice, each destroying 2 cruisers (4 total)
    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })

  it('fires each round while Exotrireme IIs and targets remain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 2, CRUISER: 2 },
        upgrades: ['DREADNOUGHT'],
        abilities: { EXOTRIREME: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CARRIER: 1, CRUISER: 5 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound() // both dreads sacrifice → 4 opponent ships destroyed

    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    expect(t.abilityLog('EXOTRIREME')).not.toHaveLength(0)
  })

  it('does not fire in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { INFANTRY: 2 },
        upgrades: ['DREADNOUGHT'],
        abilities: { EXOTRIREME: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('EXOTRIREME')).toHaveLength(0)
  })

  it('does not fire without the dreadnought upgrade', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: { EXOTRIREME: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // Exotrireme I (base) has no ability attached
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(3)
    expect(t.abilityLog('EXOTRIREME')).toHaveLength(0)
  })
})
