import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ENTROPIC_SCAR + INDOCTRINATION + MOYINS_ASHES', () => {
  it('Entropic Scar prevents mech deploy, falls back to infantry', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 2 },
        abilities: {
          INDOCTRINATION: true,
          MOYINS_ASHES: true,
          ENTROPIC_SCAR: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
        abilities: { ENTROPIC_SCAR: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('INDOCTRINATION')).not.toHaveLength(0)
    expect(t.abilityLog('MOYINS_ASHES')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(3)
    expect(t.attacker.units.MECH).toBeUndefined()
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })
})
