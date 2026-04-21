import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('HEL_TITAN + INDOCTRINATION', () => {
  it('Indoctrination does not target Hel-Titan (not infantry)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 2 },
        abilities: { INDOCTRINATION: true },
      },
      defender: {
        faction: 'TITANS_OF_UL',
        units: { PDS: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT')

    t.advanceRound()

    // Indoctrination replaces 1 infantry → PDS should be unaffected
    expect(t.defender.units.PDS).toHaveLength(1)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })
})
