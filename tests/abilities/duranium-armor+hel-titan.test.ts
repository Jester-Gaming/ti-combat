import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DURANIUM_ARMOR + HEL_TITAN', () => {
  it('Duranium Armor repairs damaged Hel-Titan that did not sustain this round', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
      defender: {
        faction: 'TITANS_OF_UL',
        units: { PDS: 1 },
        abilities: { DURANIUM_ARMOR: true },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ defender: 1 })
    expect(t.defender.units.PDS![0].isDamaged).toBeTruthy()
    t.advanceRound()
    expect(t.defender.units.PDS![0].isDamaged).toBeFalsy()
    expect(t.abilityLog('DURANIUM_ARMOR')).not.toHaveLength(0)
  })
})
