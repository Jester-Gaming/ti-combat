import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('FOURTH_MOON + SUSTAIN_DAMAGE', () => {
  it('disables opponent sustain damage', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { FLAGSHIP: 1, CRUISER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, FIGHTER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })

    // Dreadnought can't sustain (Fourth Moon disabled it), fighter is destroyed
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
    expect(t.defender.units.FIGHTER).toBeUndefined()
  })

  it('re-enables opponent sustain after a unit is destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { FLAGSHIP: 1, CRUISER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, FIGHTER: 1 },
      },
    })

    // Round 1: kill fighter via combat hits, triggers AFTER_DESTROY which re-enables sustain
    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })

    // Fighter destroyed, sustain re-enabled
    expect(t.defender.units.FIGHTER).toBeUndefined()

    // Round 2: dreadnought can now sustain
    t.advanceRound({ defender: 1 })
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })
})
