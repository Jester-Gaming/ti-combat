import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('FOURTH_MOON + QUANTUM_MANIPULATOR', () => {
  it.fails('Quantum Manipulator is not blocked for Fourth Moon', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { FLAGSHIP: 1, CRUISER: 1 },
      },
      defender: {
        faction: 'NOMAD',
        units: { CRUISER: 1, MECH: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // 1 hit to defender: mech can't sustain for ships (FM blocks sustain)
    t.advanceRound({ defender: 1 })

    // Cruiser destroyed, mech can't absorb via Quantum Manipulator
    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.defender.units.MECH).toHaveLength(1)
    expect(t.defender.units.MECH![0].isDamaged).toBeTruthy()
    expect(t.abilityLog('QUANTUM_MANIPULATOR')).not.toHaveLength(0)
  })
})
