import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ALASTOR + SALAI_SAI_CORIAN', () => {
  it('adds extra dice to Alastor based on opponent non-fighter ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: { SALAI_SAI_CORIAN: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2, DREADNOUGHT: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // 3 non-fighter opponent ships, Alastor base: [9, 2] → [9, 3]
    expect(pool.attacker).toContainDice('FLAGSHIP', [9, 3])
  })

  it('does not count opponent fighters', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: { SALAI_SAI_CORIAN: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, FIGHTER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // 1 non-fighter ship → set to 1 die
    expect(pool.attacker).toContainDice('FLAGSHIP', [9, 1])
  })
})
