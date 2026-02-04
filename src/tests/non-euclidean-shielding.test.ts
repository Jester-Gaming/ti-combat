import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('Non-Euclidean Shielding', () => {
  it('cancels 2 hits when sustaining damage', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 2 } },
      defender: {
        faction: 'BARONY_OF_LETNEV',
        units: { DREADNOUGHT: 1 },
        abilities: { NON_EUCLIDEAN_SHIELDING: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 2 })

    // Dreadnought sustains once, cancelling 2 hits
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)

    // Dreadnought survives — both hits were cancelled by a single sustain
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
  })

  it('works with multiple sustain units', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 4 } },
      defender: {
        faction: 'BARONY_OF_LETNEV',
        units: { DREADNOUGHT: 2 },
        abilities: { NON_EUCLIDEAN_SHIELDING: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 4 })

    // Each sustain cancels 2 hits: 4 - 2 - 2 = 0
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.defender.units.DREADNOUGHT![1].isDamaged).toBe(true)

    expect(t.defender.units.DREADNOUGHT).toHaveLength(2)
  })

  it('works in ground combat with mechs', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
      defender: {
        faction: 'BARONY_OF_LETNEV',
        units: { MECH: 1 },
        abilities: { NON_EUCLIDEAN_SHIELDING: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound({ defender: 2 })

    // Mech sustains once, cancelling 2 hits
    expect(t.defender.units.MECH![0].isDamaged).toBe(true)

    expect(t.defender.units.MECH).toHaveLength(1)
  })
})
