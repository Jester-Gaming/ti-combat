import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('BUNKER', () => {
  it('applies +4 to bombardment hit values', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, INFANTRY: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { BUNKER: true },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')
    const pool = t.dicePool()

    // Dreadnought bombardment: [5, 1] + 4(Bunker) = [9, 1]
    expect(pool.attacker).toContainDice('DREADNOUGHT', [9, 1])
  })
})
