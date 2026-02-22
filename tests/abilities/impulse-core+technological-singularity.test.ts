import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.skip('IMPULSE_CORE + TECHNOLOGICAL_SINGULARITY', () => {
  it('does not fire without prior kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { CRUISER: 2, DESTROYER: 1 },
        abilities: {
          IMPULSE_CORE: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // IC didn't fire — destroyer not sacrificed, defender untouched
    expect(t.attacker.units.DESTROYER).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(2)
  })
})
