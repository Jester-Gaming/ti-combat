import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ENTROPIC_SCAR', () => {
  it('disables AFB', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1, CRUISER: 1 },
        abilities: { ENTROPIC_SCAR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')
    const pool = t.dicePool()

    // AFB dice should not be present (Entropic Scar disabled AFB)
    expect(pool?.attacker?.DESTROYER).toBeUndefined()
  })

  it('disables space cannon', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, CRUISER: 1 },
        abilities: { ENTROPIC_SCAR: true },
      },
    })

    t.advanceTo('AFB')
    const pool = t.dicePool()

    // PDS SCO dice should not be present
    expect(pool?.defender?.PDS).toBeUndefined()
  })

  it('disables sustain damage', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: { ENTROPIC_SCAR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    // Dreadnought can't sustain (Entropic Scar disabled it)
    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
  })
})
