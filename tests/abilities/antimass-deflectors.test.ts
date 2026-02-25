import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ANTIMASS_DEFLECTORS', () => {
  it.forEachSide(
    'applies +1 to opponent Space Cannon Offense hit values',
    () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: {
          faction: 'ARBOREC',
          units: { CRUISER: 1 },
          abilities: { ANTIMASS_DEFLECTORS: true },
        },
        defender: {
          faction: 'ARBOREC',
          units: { PDS: 1, CRUISER: 1 },
        },
      })

      t.advanceTo('AFB')
      const pool = t.dicePool()

      expect(pool.defender).toContainDice('PDS', [7, 1])
    },
  )

  it('applies +1 to opponent Space Cannon Defense hit values', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
        abilities: { ANTIMASS_DEFLECTORS: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    const pool = t.dicePool()

    // PDS base SCD: [6, 1] + 1(Antimass) = [7, 1]
    expect(pool.defender).toContainDice('PDS', [7, 1])
  })

  it('does not affect bombardment dice', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, INFANTRY: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { ANTIMASS_DEFLECTORS: true },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')
    const pool = t.dicePool()

    // Dreadnought bombardment: [5, 1] (not affected by Antimass)
    expect(pool.attacker).toContainDice('DREADNOUGHT', [5, 1])
  })
})
