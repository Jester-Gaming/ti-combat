import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('SHIELDS_HOLDING + VAN_HAUGE', () => {
  it('does not trigger when hits are cancelled by Shields Holding', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { FLAGSHIP: 1, CRUISER: 1 },
        abilities: { SHIELDS_HOLDING: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // 2 hits on attacker, but Shields Holding cancels them
    t.advanceRound({ attacker: 2 })

    // Flagship alive — Van Hauge not triggered
    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(2)
  })
})
