import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('Salai Sai Corian', () => {
  it('rolls dice equal to opponent non-fighter ship count', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'WINNU',
        units: { FLAGSHIP: 1, FIGHTER: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2, DESTROYER: 1, FIGHTER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // 2 cruisers + 1 destroyer = 3 non-fighter ships
    expect(pool.attacker).toContainDice('FLAGSHIP', [7, 3])
  })

  it('rolls 0 dice when opponent has only fighters', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'WINNU',
        units: { FLAGSHIP: 1 },
      },
      defender: { faction: 'ARBOREC', units: { FIGHTER: 4 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    expect(pool.attacker).toContainDice('FLAGSHIP', [7, 0])
  })

  it('counts all non-fighter ship types', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'WINNU',
        units: { FLAGSHIP: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2, CARRIER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // 2 dreadnoughts + 1 carrier = 3
    expect(pool.attacker).toContainDice('FLAGSHIP', [7, 3])
  })

  it('counts opponent flagship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'WINNU',
        units: { FLAGSHIP: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, FLAGSHIP: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // 1 cruiser + 1 flagship = 2
    expect(pool.attacker).toContainDice('FLAGSHIP', [7, 2])
  })
})
