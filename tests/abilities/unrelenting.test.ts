import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('UNRELENTING', () => {
  it.forEachSide('applies -1 to space combat rolls', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { CRUISER: 1, DREADNOUGHT: 1 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Cruiser: 7 - 1(Unrelenting) = 6
    expect(pool.attacker).toContainDice('CRUISER', [6, 1])
    // Dreadnought: 5 - 1(Unrelenting) = 4
    expect(pool.attacker).toContainDice('DREADNOUGHT', [4, 1])
  })

  it.forEachSide('applies -1 to ground combat rolls', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { INFANTRY: 2, MECH: 1 },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Infantry: 8 - 1(Unrelenting) = 7
    expect(pool.attacker).toContainDice('INFANTRY', [7, 1])
    // Mech (Valkyrie Exoskeleton): 6 - 1(Unrelenting) = 5
    expect(pool.attacker).toContainDice('MECH', [5, 1])
  })

  it('does NOT apply to bombardment rolls', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')
    const pool = t.dicePool()

    // Sardakk Dreadnought (Exotrireme) bombardment: [4, 2]
    // Unrelenting should NOT apply (BEFORE_DICE_ROLL only, not BEFORE_UNIT_ABILITY_ROLL)
    expect(pool.attacker).toContainDice('DREADNOUGHT', [4, 2])
  })

  it('does NOT apply to AFB rolls', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DESTROYER: 1, CRUISER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { FIGHTER: 2, CRUISER: 1 },
      },
    })

    t.advanceTo('AFB', 'ASSIGN_HITS')
    const pool = t.dicePool()

    // Destroyer AFB: [9, 2] — Unrelenting should NOT apply
    expect(pool.attacker).toContainDice('DESTROYER', [9, 2])
  })
})
