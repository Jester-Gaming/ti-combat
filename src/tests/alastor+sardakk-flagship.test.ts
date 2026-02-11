import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('ALASTOR + SARDAKK_FLAGSHIP', () => {
  it('applies -1 aura to infantry and mech participating via Alastor', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, INFANTRY: 1, MECH: 1 },
        abilities: { SARDAKK_FLAGSHIP: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Flagship: [9, 2] (aura doesn't apply to FLAGSHIP source)
    expect(pool.attacker).toContainDice('FLAGSHIP', [9, 2])
    // Infantry via Alastor: 8 - 1(aura) = 7
    expect(pool.attacker).toContainDice('INFANTRY', [7, 1])
    // Mech (Mordred) via Alastor: 6 - 1(aura) = 5
    expect(pool.attacker).toContainDice('MECH', [5, 1])
  })
})
