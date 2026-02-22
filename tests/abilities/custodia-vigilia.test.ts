import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('CUSTODIA_VIGILIA', () => {
  it('adds [5, 1] dice to SCO', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'COUNCIL_KELERES',
        units: { CRUISER: 1 },
        abilities: { CUSTODIA_VIGILIA: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()!

    expect(pool.defender).toContainDice('CUSTODIA_VIGILIA', [5, 1])
  })

  it('adds [5, 1] dice to SCD', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
      defender: {
        faction: 'COUNCIL_KELERES',
        units: { INFANTRY: 2 },
        abilities: { CUSTODIA_VIGILIA: true },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    const pool = t.dicePool()!

    expect(pool.defender).toContainDice('CUSTODIA_VIGILIA', [5, 1])
  })

  it('combines with existing PDS dice during SCO', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'COUNCIL_KELERES',
        units: { CRUISER: 1, PDS: 1 },
        abilities: { CUSTODIA_VIGILIA: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()!

    expect(pool.defender).toContainDice('PDS', [6, 1])
    expect(pool.defender).toContainDice('CUSTODIA_VIGILIA', [5, 1])
  })

  it('does not add dice during combat rounds', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'COUNCIL_KELERES',
        units: { CRUISER: 1 },
        abilities: { CUSTODIA_VIGILIA: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    expect(pool.defender.CUSTODIA_VIGILIA).toBeUndefined()
  })

  it('attacker dice are ignored during SCD', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'COUNCIL_KELERES',
        units: { INFANTRY: 2 },
        abilities: { CUSTODIA_VIGILIA: true },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.advanceTo('GROUND_COMBAT')
    const pool = t.dicePool()!

    expect(pool.attacker?.CUSTODIA_VIGILIA).toBeUndefined()
  })
})
