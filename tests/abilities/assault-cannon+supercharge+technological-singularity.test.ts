import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.skip('ASSAULT_CANNON + SUPERCHARGE + TECHNOLOGICAL_SINGULARITY', () => {
  it('supercharge activates round 1 after assault cannon kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { CRUISER: 3 },
        abilities: {
          ASSAULT_CANNON: true,
          SUPERCHARGE: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // AC kills at START_OF_COMBAT → TS triggers → Supercharge active
    // Cruiser: 7 - 1(supercharge) = 6
    expect(pool.attacker).toContainDice('CRUISER', [6, 1])
  })
})
