import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ARTICLES_OF_WAR + INDOMITUS', () => {
  it('strips Indomitus Space Cannon during SCD', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { ARTICLES_OF_WAR: true },
      },
      defender: {
        faction: 'XXCHA_KINGDOM',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: { ARTICLES_OF_WAR: true },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    const pool = t.dicePool()

    // Indomitus MECH SC should be stripped — no SC dice
    expect(pool?.defender?.MECH).toBeUndefined()
  })

  it('strips Indomitus Space Cannon during SCO', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { ARTICLES_OF_WAR: true },
      },
      defender: {
        faction: 'XXCHA_KINGDOM',
        units: { CRUISER: 1, MECH: 1 },
        abilities: { ARTICLES_OF_WAR: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // Indomitus MECH SC should be stripped — no SC dice during SCO
    expect(pool?.defender?.MECH).toBeUndefined()
  })
})
