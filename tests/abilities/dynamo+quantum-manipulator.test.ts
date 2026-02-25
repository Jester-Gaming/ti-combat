import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DYNAMO + QUANTUM_MANIPULATOR', () => {
  it('Dynamo repairs QM mech after it sustains to absorb a ship hit', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
      defender: {
        faction: 'NOMAD',
        units: { CRUISER: 1, MECH: 1 },
        abilities: { DYNAMO: { uses: 5 } },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // 1 hit to defender: QM sustains, Dynamo repairs
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.defender.units.MECH).toHaveLength(1)
    expect(t.defender.units.MECH![0].isDamaged).toBe(false)
    expect(t.abilityLog('QUANTUM_MANIPULATOR')).not.toHaveLength(0)
    expect(t.abilityLog('DYNAMO')).not.toHaveLength(0)
  })
})
