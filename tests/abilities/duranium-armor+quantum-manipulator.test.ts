import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DURANIUM_ARMOR + QUANTUM_MANIPULATOR', () => {
  it('Duranium Armor does not repair the mech', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
      defender: {
        faction: 'NOMAD',
        units: { CRUISER: 1, MECH: 1 },
        abilities: { DURANIUM_ARMOR: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })
    expect(t.defender.units.MECH![0].isDamaged).toBe(true)

    t.advanceRound()
    // Mech sustains via Quantum Manipulator
    // Duranium Armor does not repair the mech — MECH is not in nonFighterShips
    expect(t.defender.units.MECH![0].isDamaged).toBe(true)
  })
})
