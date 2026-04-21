import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('THE_EGEIRO', () => {
  it('applies +N modifier based on nonHomeSystems param', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'LAST_BASTION',
        units: { FLAGSHIP: 1 },
        abilities: { THE_EGEIRO: { nonHomeSystems: 3 } },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Egeiro base: [9, 1], -3 from nonHomeSystems = [6, 1]
    expect(pool.attacker).toContainDice('FLAGSHIP', [6, 1])
  })

  it('only modifies flagship, not other ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'LAST_BASTION',
        units: { FLAGSHIP: 1, CRUISER: 1 },
        abilities: { THE_EGEIRO: { nonHomeSystems: 2 } },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Egeiro: [9, 1] - 2 = [7, 1]
    expect(pool.attacker).toContainDice('FLAGSHIP', [7, 1])
    // Cruiser unaffected: [7, 1]
    expect(pool.attacker).toContainDice('CRUISER', [7, 1])
  })
})
