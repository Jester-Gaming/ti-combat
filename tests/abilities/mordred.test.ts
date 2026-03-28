import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('MORDRED', () => {
  it('+2 applies by default', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { MECH: 1 },
        abilities: { MORDRED: true },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Mech base: [6, 1], Mordred -2 → [4, 1]
    expect(pool.attacker).toContainDice('MECH', [4, 1])
  })
})
