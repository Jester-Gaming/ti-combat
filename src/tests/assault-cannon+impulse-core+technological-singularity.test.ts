import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe.skip('ASSAULT_CANNON + IMPULSE_CORE + TECHNOLOGICAL_SINGULARITY', () => {
  it('impulse core fires after assault cannon kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { CRUISER: 3, DESTROYER: 1 },
        abilities: {
          ASSAULT_CANNON: true,
          IMPULSE_CORE: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // AC destroys 1 cruiser → TS triggers → IC sacrifices destroyer, hits cruiser
    expect(t.attacker.units.DESTROYER).toBeUndefined()
    // 3 - 1(AC) - 1(IC) = 1
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })
})
