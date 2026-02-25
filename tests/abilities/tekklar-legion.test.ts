import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('TEKKLAR_LEGION', () => {
  it('improves own dice and worsens Sardakk opponent dice', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: {
          TEKKLAR_LEGION: true,
        },
      },
      defender: {
        faction: 'SARDAKK_NORR',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Attacker: 8 - 1(tekklar) = 7
    expect(pool.attacker).toContainDice('INFANTRY', [7, 1])
    // Defender (Sardakk): 7 + 1(tekklar penalty) = 8
    expect(pool.defender).toContainDice('INFANTRY', [8, 1])
  })

  it('only improves own dice, does not affect opponent vs non-Sardakk', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: {
          TEKKLAR_LEGION: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Attacker: 8 - 1(tekklar) = 7
    expect(pool.attacker).toContainDice('INFANTRY', [7, 1])
    // Defender (not Sardakk): unchanged at 8
    expect(pool.defender).toContainDice('INFANTRY', [8, 1])
  })

  it('modifier persists across multiple rounds (during this combat)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
        abilities: { TEKKLAR_LEGION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')

    // Round 1: Tekklar fires, infantry rolls at 7
    t.advanceRound(0)
    const pool1 = t.dicePool()
    // Infantry: 8 - 1(Tekklar) = 7
    expect(pool1.attacker).toContainDice('INFANTRY', [7, 1])

    // Round 2: Tekklar should still apply (during this combat)
    t.advanceRound(0)
    const pool2 = t.dicePool()
    // Infantry: 8 - 1(Tekklar) = 7 (should persist)
    expect(pool2.attacker).toContainDice('INFANTRY', [7, 1])
  })
})
