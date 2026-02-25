import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ARTICLES_OF_WAR + QUANTUM_MANIPULATOR', () => {
  it('strips QM printed ability — mech cannot absorb hits for ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { ARTICLES_OF_WAR: true },
      },
      defender: {
        faction: 'NOMAD',
        units: { CRUISER: 1, MECH: 1 },
        abilities: { ARTICLES_OF_WAR: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // 1 hit to defender: QM ability stripped by AoW, mech can't absorb for ships
    t.advanceRound({ defender: 1 })

    // Cruiser destroyed — QM couldn't absorb the hit
    expect(t.defender.units.CRUISER).toBeUndefined()
    expect(t.abilityLog('QUANTUM_MANIPULATOR')).toHaveLength(0)
  })

  it('mech still retains Sustain Damage itself under Articles of War', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { ARTICLES_OF_WAR: true },
      },
      defender: {
        faction: 'NOMAD',
        units: { MECH: 1 },
        abilities: {
          ARTICLES_OF_WAR: true,
          SUSTAIN_DAMAGE: {
            groundPriority: ['MECH'],
          },
        },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.MECH).toHaveLength(1)
    expect(t.defender.units.MECH![0].isDamaged).toBe(true)
  })
})
