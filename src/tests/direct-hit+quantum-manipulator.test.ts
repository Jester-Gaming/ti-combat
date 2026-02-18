import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('DIRECT_HIT + QUANTUM_MANIPULATOR', () => {
  it('Direct Hit does not trigger when mech sustains via Quantum Manipulator', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { DIRECT_HIT: { uses: 4 } },
      },
      defender: {
        faction: 'NOMAD',
        units: { CRUISER: 1, MECH: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })

    // Mech sustains but Direct Hit cannot target it (not a ship)
    expect(t.defender.units.MECH).toHaveLength(1)
    expect(t.defender.units.MECH![0].isDamaged).toBe(true)
    expect(t.abilityLog('QUANTUM_MANIPULATOR')).toHaveLength(1)
    expect(t.abilityLog('DIRECT_HIT')).toHaveLength(0)
  })
})
