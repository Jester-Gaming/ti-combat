import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ALASTOR + FOURTH_MOON', () => {
  it('disables opponent sustain damage', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, CRUISER: 1 },
        abilities: { FOURTH_MOON: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, FIGHTER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })

    // Dreadnought can't sustain (Fourth Moon disabled it)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
    expect(t.defender.units.FIGHTER).toBeUndefined()
  })

  it('re-enables opponent sustain when Alastor is destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: { FOURTH_MOON: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')

    // Round 1: flagship sustains
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)
    expect(
      t.defender.unitAbilityRestrictions?.cannotBeUsed?.SUSTAIN_DAMAGE,
    ).toBeDefined()

    // Round 2: flagship destroyed → AFTER_DESTROY removes sustain restriction
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
    expect(
      t.defender.unitAbilityRestrictions?.cannotBeUsed?.SUSTAIN_DAMAGE,
    ).toBeFalsy()
  })
})
