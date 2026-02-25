import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('CONVENTIONS_OF_WAR', () => {
  it('blocks bombardment for both sides', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, INFANTRY: 1 },
        abilities: { CONVENTIONS_OF_WAR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { CONVENTIONS_OF_WAR: true },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')
    const pool = t.dicePool()

    // Dreadnought bombardment blocked
    expect(pool?.attacker?.DREADNOUGHT).toBeUndefined()
  })

  it('does not block space cannon defense', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { CONVENTIONS_OF_WAR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 1 },
        abilities: { CONVENTIONS_OF_WAR: true },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    const pool = t.dicePool()

    // PDS SCD still works: [6, 1]
    expect(pool.defender).toContainDice('PDS', [6, 1])
  })
})
