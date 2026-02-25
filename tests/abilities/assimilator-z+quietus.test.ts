import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ASSIMILATOR_Z + QUIETUS', () => {
  it.fails('disables opponent sustain but Nekro keeps sustain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, DREADNOUGHT: 1 },
        abilities: { QUIETUS: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1, defender: 1 })

    // Nekro flagship sustained — keeps sustain
    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)

    // Opponent dreadnought could not sustain — destroyed
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
  })

  it('fires without error when Alastor is destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: { QUIETUS: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')

    // Round 1: sustain
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)

    // Round 2: destroyed → Quietus AFTER_DESTROY fires
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
  })
})
