import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('EMERGENCY_REPAIRS + QUANTUM_MANIPULATOR', () => {
  it('repairs a Nomad mech that sustained a hit via Quantum Manipulator', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NOMAD',
        units: { CRUISER: 1, MECH: 1 },
        abilities: { EMERGENCY_REPAIRS: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Cruiser takes a hit → Quantum Manipulator uses the mech's sustain to cancel it.
    // Mech is the only sustain-in-stats unit → condition met at END_OF_COMBAT_ROUND → ER repairs it.
    t.advanceRound({ attacker: 1 })
    expect(t.abilityLog('QUANTUM_MANIPULATOR')).not.toHaveLength(0)
    expect(t.abilityLog('EMERGENCY_REPAIRS')).not.toHaveLength(0)
    expect(t.attacker.units.MECH![0].isDamaged).toBeFalsy()
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })

  it('does not fire when mech is damaged but dreadnought is not (mech counts toward the condition)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NOMAD',
        units: { DREADNOUGHT: 1, CRUISER: 1, MECH: 1 },
        abilities: {
          PRE_DAMAGED: { isEnabled: true, damagedUnits: { MECH: 1 } },
          EMERGENCY_REPAIRS: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Mech starts damaged; dread (also sustain-in-stats) is undamaged.
    // Condition "all sustain units damaged" fails → ER must not fire.
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBeFalsy()

    t.advanceRound({ attacker: 0 })
    expect(t.abilityLog('EMERGENCY_REPAIRS')).toHaveLength(0)
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
  })
})
