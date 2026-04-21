import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('QUANTUM_MANIPULATOR + REFLECTIVE_SHIELDING', () => {
  it('Reflective Shielding does not trigger when mech sustains via Quantum Manipulator', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
      defender: {
        faction: 'NOMAD',
        units: { CRUISER: 1, MECH: 1 },
        abilities: { REFLECTIVE_SHIELDING: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    // Mech sustains but Reflective Shielding doesn't trigger (mech is not a ship)
    expect(t.defender.units.MECH).toHaveLength(1)
    expect(t.defender.units.MECH![0].isDamaged).toBe(true)
    expect(t.abilityLog('QUANTUM_MANIPULATOR')).not.toHaveLength(0)
    expect(t.abilityLog('REFLECTIVE_SHIELDING')).toHaveLength(0)
  })
})
