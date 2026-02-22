import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('DIMENSIONAL_SPLICER + METALI_VOID_SHIELDING', () => {
  it('absorbs Dimensional Splicer hit on a non-sustain ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'GHOSTS_OF_CREUSS',
        units: { CRUISER: 1 },
        abilities: { DIMENSIONAL_SPLICER: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { METALI_VOID_SHIELDING: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // DS adds 1 hit targeting Cruiser, Void Shielding sustains it
    expect(t.defender.units.CRUISER).toHaveLength(2)
    expect(t.defender.units.CRUISER!.filter(u => u.isDamaged)).toHaveLength(1)
    expect(t.abilityLog('METALI_VOID_SHIELDING')).not.toHaveLength(0)
  })
})
