import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('IMPULSE_CORE + SLEEPER_CELL', () => {
  it('SC copies opponent self-destroyed ship from Impulse Core sacrifice', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 3 },
        abilities: {
          SLEEPER_CELL: true,
        },
      },
      defender: {
        faction: 'YIN_BROTHERHOOD',
        units: { CRUISER: 2, DESTROYER: 1 },
        abilities: { IMPULSE_CORE: true },
      },
    })

    // SC activates, then Impulse Core fires:
    // IC destroys defender's own destroyer (sacrifice) and hits attacker's ship
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('IMPULSE_CORE')).not.toHaveLength(0)
    // IC destroyed defender's own destroyer — SC copies opponent's destroyed ships
    // SC should place 1 destroyer for attacker
    expect(t.attacker.units.DESTROYER).toHaveLength(1)
  })
})
