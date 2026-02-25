import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('PLASMA_SCORING', () => {
  it('adds 1 die to bombardment (BEST strategy)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, INFANTRY: 1 },
        abilities: { PLASMA_SCORING: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')
    const pool = t.dicePool()

    // Dreadnought bombardment: [5, 1] + 1 die = [5, 2]
    expect(pool.attacker).toContainDice('DREADNOUGHT', [5, 2])
  })

  it.forEachSide('adds 1 die to Space Cannon Offense', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, CRUISER: 1 },
        abilities: { PLASMA_SCORING: true },
      },
    })

    t.advanceTo('AFB')
    const pool = t.dicePool()

    // PDS base SCO: [6, 1] + 1 die = [6, 2]
    expect(pool.defender).toContainDice('PDS', [6, 2])
  })

  it('adds 1 die to Space Cannon Defense', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 1 },
        abilities: { PLASMA_SCORING: true },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    const pool = t.dicePool()

    // PDS base SCD: [6, 1] + 1 die = [6, 2]
    expect(pool.defender).toContainDice('PDS', [6, 2])
  })

  it.forEachSide('does not add dice when no unit ability dice exist', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { PLASMA_SCORING: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    // No SCO dice for attacker (no PDS/space dock with space cannon)
    t.advanceTo('AFB')

    expect(t.abilityLog('PLASMA_SCORING')).toHaveLength(0)
  })
})
