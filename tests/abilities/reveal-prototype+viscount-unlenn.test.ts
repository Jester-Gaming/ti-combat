import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('REVEAL_PROTOTYPE + VISCOUNT_UNLENN', () => {
  it('Viscount adds a die on top of the upgraded cruiser stats', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          REVEAL_PROTOTYPE: { isEnabled: true, spacePriority: ['CRUISER'] },
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'CRUISER' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Cruiser base [7, 1] -> Reveal Prototype upgrade -> [6, 1]
    // Viscount adds 1 die to one CRUISER:Viscount subtype -> [6, 2]
    expect(pool.attacker).toContainDice('CRUISER', [6, 2], [6, 1])
    expect(t.abilityLog('REVEAL_PROTOTYPE')).not.toHaveLength(0)
    expect(t.abilityLog('VISCOUNT_UNLENN')).not.toHaveLength(0)
  })
})
