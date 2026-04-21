import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('CAVALRY + THE_EGEIRO', () => {
  it('Cavalry overrides flagship stats but Egeiro unit ability still fires', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'LAST_BASTION',
        units: { FLAGSHIP: 1, CRUISER: 1 },
        abilities: {
          THE_EGEIRO: { isEnabled: true, nonHomeSystems: 2 },
          CAVALRY: { isEnabled: true, unitType: 'FLAGSHIP' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Cavalry overrides FLAGSHIP combat to Nomad flagship [7, 2]
    // Egeiro still fires: 7 - 2(Egeiro) = 5, 2 dice
    expect(pool.attacker).toContainDice('FLAGSHIP', [5, 2])
  })
})
