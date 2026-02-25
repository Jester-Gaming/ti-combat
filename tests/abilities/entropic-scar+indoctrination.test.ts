import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ENTROPIC_SCAR + INDOCTRINATION', () => {
  it('Entropic Scar does not disable Indoctrination (faction ability, not unit ability)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 2 },
        abilities: {
          INDOCTRINATION: true,
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

    // Indoctrination should still fire despite Entropic Scar
    expect(t.abilityLog('INDOCTRINATION')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(3)
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })

  it.fails('Entropic Scar disables Yin mech ability', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 2 },
        abilities: {
          INDOCTRINATION: true,
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

    expect(t.abilityLog('INDOCTRINATION')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
    expect(t.defender.units.INFANTRY).toHaveLength(3)
  })
})
