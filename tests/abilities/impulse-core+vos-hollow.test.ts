import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('IMPULSE_CORE + VOS_HOLLOW', () => {
  it('triggers when Impulse Core sacrifices own ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { CRUISER: 2, DESTROYER: 1 },
        abilities: { IMPULSE_CORE: true, VOS_HOLLOW: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2, DESTROYER: 1 },
      },
    })

    // Impulse Core sacrifices attacker Destroyer → AFTER_DESTROY →
    // Vos Hollow triggers → opponent Destroyer destroyed
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.attacker.units.DESTROYER).toBeUndefined()
    expect(t.defender.units.DESTROYER).toBeUndefined()
    expect(t.abilityLog('VOS_HOLLOW').length).toBeGreaterThan(0)
  })
})
