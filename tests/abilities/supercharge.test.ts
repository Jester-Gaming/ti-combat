import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('SUPERCHARGE', () => {
  it('applies -1 to combat rolls in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1 },
        abilities: { SUPERCHARGE: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Cruiser: 7 - 1(Supercharge) = 6
    expect(pool.attacker).toContainDice('CRUISER', [6, 1])
  })

  it('applies -1 to combat rolls in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { INFANTRY: 2 },
        abilities: { SUPERCHARGE: true },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Infantry: 8 - 1(Supercharge) = 7
    expect(pool.attacker).toContainDice('INFANTRY', [7, 1])
  })
})
