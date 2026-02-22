import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ALASTOR + ARVICON_REX + SALAI_SAI_CORIAN', () => {
  it('modifier applies to all dice including added ones', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: {
          ARVICON_REX: { isEnabled: true, uses: Infinity },
          SALAI_SAI_CORIAN: { isEnabled: true, uses: Infinity },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Alastor base: [9, 2]
    // Arvicon Rex: -2 to flagship → [7, 2]
    // Salai Sai Corian: set to 3 non-fighter ships → [7, 3]
    expect(pool.attacker).toContainDice('FLAGSHIP', [7, 3])
  })
})
