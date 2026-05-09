import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('CAVALRY + SALAI_SAI_CORIAN', () => {
  it('counts a Cavalry-cruiser as a non-fighter ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'WINNU',
        units: { FLAGSHIP: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'CRUISER' },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // 1 (Cavalry) cruiser is still 1 non-fighter ship.
    // Bug: strict countUnits('CRUISER') = 0 → flagship gets [7, 0] → no dice.
    expect(pool.attacker).toContainDice('FLAGSHIP', [7, 1])
  })
})
