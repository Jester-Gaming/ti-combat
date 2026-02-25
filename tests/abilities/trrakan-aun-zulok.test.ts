import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('TRRAKAN_AUN_ZULOK', () => {
  it('adds 1 extra die to AFB roll when AFB selected', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1 },
        abilities: {
          TRRAKAN_AUN_ZULOK: { isEnabled: true, phases: ['AFB'] },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, FIGHTER: 1 },
      },
    })

    t.advanceTo('AFB', 'ASSIGN_HITS', 0)
    const pool = t.dicePool()

    // Destroyer AFB: [9, 2] + 1 from Trrakan = [9, 3]
    expect(pool.attacker).toContainDice('DESTROYER', [9, 3])
  })
})
