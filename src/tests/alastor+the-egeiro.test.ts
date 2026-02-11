import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('ALASTOR + THE_EGEIRO', () => {
  it('reduces flagship hit value by nonHomeSystems', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, INFANTRY: 1 },
        abilities: {
          THE_EGEIRO: { isEnabled: true, uses: Infinity, nonHomeSystems: 2 },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // The Egeiro: -2 to FLAGSHIP only
    // Alastor: 9 - 2 = 7
    expect(pool.attacker).toContainDice('FLAGSHIP', [7, 2])
    // Infantry via Alastor: unaffected
    expect(pool.attacker).toContainDice('INFANTRY', [8, 1])
  })

  it('does not fire when nonHomeSystems is 0', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: { THE_EGEIRO: { isEnabled: true, nonHomeSystems: 0 } },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // No modification: Alastor base [9, 2]
    expect(pool.attacker).toContainDice('FLAGSHIP', [9, 2])
  })
})
