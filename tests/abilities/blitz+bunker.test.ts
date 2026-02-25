import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('BLITZ + BUNKER', () => {
  it('Bunker applies +4 to bombardment gained via Blitz', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, INFANTRY: 1 },
        abilities: { BLITZ: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { BUNKER: true },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')
    const pool = t.dicePool()

    // Cruiser gains Bombardment [6, 1] from Blitz
    // Bunker adds +4: [10, 1]
    expect(pool.attacker).toContainDice('CRUISER', [10, 1])
  })
})
