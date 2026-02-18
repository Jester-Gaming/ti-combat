import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('QUANTUM_MANIPULATOR', () => {
  it('mech absorbs a hit produced against ships in space', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
      defender: {
        faction: 'NOMAD',
        units: { CRUISER: 1, MECH: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })

    // Mech sustains instead of losing a ship
    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.defender.units.MECH).toHaveLength(1)
    expect(t.defender.units.MECH![0].isDamaged).toBe(true)
    expect(t.abilityLog('QUANTUM_MANIPULATOR')).toHaveLength(1)
  })

  it('multiple mechs can each absorb one hit', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
      defender: {
        faction: 'NOMAD',
        units: { CRUISER: 1, MECH: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 2 })

    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.defender.units.MECH).toHaveLength(2)
    expect(t.defender.units.MECH!.filter(u => u.isDamaged)).toHaveLength(2)
    expect(t.abilityLog('QUANTUM_MANIPULATOR')).toHaveLength(2)
  })

  it('does not fire when mech is already damaged', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
      defender: {
        faction: 'NOMAD',
        units: { CRUISER: 2, MECH: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: mech absorbs 1 hit
    t.advanceRound({ defender: 1 })
    expect(t.defender.units.MECH![0].isDamaged).toBe(true)
    expect(t.abilityLog('QUANTUM_MANIPULATOR')).toHaveLength(1)

    // Round 2: mech already damaged, can't absorb
    t.advanceRound({ defender: 1 })
    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.abilityLog('QUANTUM_MANIPULATOR')).toHaveLength(1)
  })
})
