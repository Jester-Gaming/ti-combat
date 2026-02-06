import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('MYRU_VOS', () => {
  it('disables space cannon offense for opponent PDS', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          MYRU_VOS: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 2, CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    const pool = t.dicePool()!

    expect(pool.defender.PDS).toBeUndefined()
  })

  it('does not produce SCO hits when active', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: {
          MYRU_VOS: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 2, CRUISER: 1 },
      },
    })

    t.advanceTo('AFB')

    // All cruisers survive — no SCO hits
    expect(t.attacker.units.CRUISER).toHaveLength(3)
  })
})
