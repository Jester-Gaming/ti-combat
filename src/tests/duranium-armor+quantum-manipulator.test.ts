import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('DURANIUM_ARMOR + QUANTUM_MANIPULATOR', () => {
  it('Duranium Armor does not repair the mech (not in repair priority)', () => {
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

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })

    // Mech sustains via Quantum Manipulator
    expect(t.defender.units.MECH![0].isDamaged).toBe(true)
    // Duranium Armor does not repair the mech — MECH is not in nonFighterShips
    expect(t.defender.units.MECH![0].isDamaged).toBe(true)
  })
})
