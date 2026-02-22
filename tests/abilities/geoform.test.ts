import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('GEOFORM', () => {
  it('adds [5, 3] dice to SCO', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { GEOFORM: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()!

    expect(pool.defender).toContainDice('GEOFORM', [5, 3])
  })

  it('adds [5, 3] dice to SCD', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { GEOFORM: true },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    const pool = t.dicePool()!

    expect(pool.defender).toContainDice('GEOFORM', [5, 3])
  })

  it('does not add dice during combat rounds', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { GEOFORM: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    expect(pool.defender.GEOFORM).toBeUndefined()
  })
})
