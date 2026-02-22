import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ARTICLES_OF_WAR', () => {
  it('mech Sustain Damage is preserved', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { MECH: 1 },
        abilities: {
          ARTICLES_OF_WAR: true,
          SUSTAIN_DAMAGE: {
            groundPriority: ['MECH'],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
    expect(t.attacker.units.MECH).toHaveLength(1)
  })

  it('non-mech sustain is unaffected', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: {
          ARTICLES_OF_WAR: true,
          SUSTAIN_DAMAGE: {
            spacePriority: ['DREADNOUGHT'],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
  })

  it('affects opponent mechs too', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
        abilities: {
          ARTICLES_OF_WAR: true,
        },
      },
      defender: {
        faction: 'SARDAKK_NORR',
        units: { MECH: 1 },
        abilities: {
          SUSTAIN_DAMAGE: {
            groundPriority: ['MECH'],
          },
        },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound({ defender: 1 })

    // Defender mech sustains
    expect(t.defender.units.MECH![0].isDamaged).toBe(true)
  })
})
