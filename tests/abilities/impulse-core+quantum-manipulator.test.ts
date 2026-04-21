import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('IMPULSE_CORE + QUANTUM_MANIPULATOR', () => {
  it('QM absorbs the Impulse Core hit for a ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { CRUISER: 1, DESTROYER: 1 },
        abilities: {
          IMPULSE_CORE: true,
        },
      },
      defender: {
        faction: 'NOMAD',
        units: { CRUISER: 1, MECH: 1 },
      },
    })

    // Advance past START_OF_COMBAT where Impulse Core fires
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // QM should absorb the IC hit — cruiser survives
    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.defender.units.MECH).toHaveLength(1)
    expect(t.defender.units.MECH![0].isDamaged).toBe(true)
    expect(t.abilityLog('QUANTUM_MANIPULATOR')).not.toHaveLength(0)
  })
})
