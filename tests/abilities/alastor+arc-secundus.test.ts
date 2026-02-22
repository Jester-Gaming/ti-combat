import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ALASTOR + ARC_SECUNDUS', () => {
  it('heals Alastor at start of each combat round', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, CRUISER: 1 },
        abilities: { ARC_SECUNDUS: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')

    // Round 1: flagship sustains 1 hit
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)

    // Round 2: Arc Secundus heals at START, no new damage
    t.advanceRound()
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(false)
  })

  it('disables opponent planetary shield', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: { ARC_SECUNDUS: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    expect(
      t.defender.unitAbilityRestrictions?.lost?.PLANETARY_SHIELD,
    ).toBeDefined()
  })
})
