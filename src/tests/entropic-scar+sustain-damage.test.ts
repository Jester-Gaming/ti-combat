import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('ENTROPIC_SCAR + SUSTAIN_DAMAGE', () => {
  it('disables sustain for both sides', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: {
          ENTROPIC_SCAR: true,
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1, defender: 1 })

    // Neither dreadnought sustained (Entropic Scar disabled sustain)
    // Both dreadnoughts destroyed
    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
  })
})
