import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('EXPERIMENTAL_BATTLESTATION', () => {
  it('adds [5, 3] dice to SCO for defender', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { EXPERIMENTAL_BATTLESTATION: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    expect(pool.defender).toContainDice('EXPERIMENTAL_BATTLESTATION', [5, 3])
  })

  it('combines with existing PDS dice', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, PDS: 1 },
        abilities: { EXPERIMENTAL_BATTLESTATION: true },
      },
    })

    t.advanceTo('AFB')
    const pool = t.dicePool()

    expect(pool.defender).toContainDice('PDS', [6, 1])
    expect(pool.defender).toContainDice('EXPERIMENTAL_BATTLESTATION', [5, 3])
  })

  it('produces hits against attacker ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { EXPERIMENTAL_BATTLESTATION: true },
      },
    })

    // SCO hits: attacker receives 2 hits from defender's battlestation dice
    t.advanceTo('AFB', undefined, { attacker: 2 })

    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })

  it('fires SCO even when defender has no units', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'ARBOREC',
        units: {},
        abilities: { EXPERIMENTAL_BATTLESTATION: true },
      },
    })

    // SCO runs despite defender having 0 units
    t.advanceTo('COMPLETE', undefined, { attacker: 2 })

    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })
})
