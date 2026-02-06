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

  it('re-enables opponent sustain when Fourth Moon is destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { FLAGSHIP: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')

    // Round 1: flagship sustains — sustain restriction still active
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)
    expect(
      t.defender.unitAbilityRestrictions?.cannotBeUsed?.SUSTAIN_DAMAGE,
    ).toBeDefined()

    // Round 2: flagship destroyed — AFTER_DESTROY removes sustain restriction
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
    expect(
      t.defender.unitAbilityRestrictions?.cannotBeUsed?.SUSTAIN_DAMAGE,
    ).toBeFalsy()
  })
})
