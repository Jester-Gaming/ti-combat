import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('ANTIMASS_DEFLECTORS + SOLAR_FLARE', () => {
  it('Solar Flare disables space cannon entirely', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          SOLAR_FLARE: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, CRUISER: 1 },
        abilities: {
          ANTIMASS_DEFLECTORS: true,
        },
      },
    })

    t.setPhase('SPACE_CANNON_OFFENSE', 'DICE_ROLL')
    const dice = t.runDiceTiming('SPACE_CANNON')

    // No PDS dice (Solar Flare disabled space cannon)
    expect(dice.defender.PDS).toBeUndefined()
  })
})
