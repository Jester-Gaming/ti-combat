import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('STRIKE_WING_AMBUSCADE', () => {
  it('adds 1 extra die to AFB roll', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1 },
        abilities: {
          STRIKE_WING_AMBUSCADE: {
            isEnabled: true,
            uses: 1,
            phases: ['AFB'],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1, FIGHTER: 1 } },
    })

    t.advanceTo('AFB', 'ASSIGN_HITS', 0)
    const pool = t.dicePool()

    // Destroyer AFB: [9, 2] + 1 from SWA = [9, 3]
    expect(pool.attacker).toContainDice('DESTROYER', [9, 3])
  })

  it('adds 1 extra die to Space Cannon Offense roll', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, CRUISER: 1 },
        abilities: {
          STRIKE_WING_AMBUSCADE: {
            isEnabled: true,
            uses: 1,
            phases: ['SPACE_CANNON_OFFENSE'],
          },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // PDS SCO: [6, 1] + 1 from SWA = [6, 2]
    expect(pool.defender).toContainDice('PDS', [6, 2])
  })

  it('does not add die when no units have unit abilities', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          STRIKE_WING_AMBUSCADE: {
            isEnabled: true,
            uses: 1,
            phases: ['SPACE_CANNON_OFFENSE'],
          },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    expect(pool?.defender?.PDS).toBeUndefined()
  })

  it('adds 1 extra die to Bombardment roll', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, INFANTRY: 1 },
        abilities: {
          STRIKE_WING_AMBUSCADE: {
            isEnabled: true,
            uses: 1,
            phases: ['BOMBARDMENT'],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')
    const pool = t.dicePool()

    // Dreadnought Bombardment: [5, 1] + 1 from SWA = [5, 2]
    expect(pool.attacker).toContainDice('DREADNOUGHT', [5, 2])
  })

  it('adds 1 extra die to Space Cannon Defense roll', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 1 },
        abilities: {
          STRIKE_WING_AMBUSCADE: {
            isEnabled: true,
            uses: 1,
            phases: ['SPACE_CANNON_DEFENSE'],
          },
        },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    const pool = t.dicePool()

    // PDS SCD: [6, 1] + 1 from SWA = [6, 2]
    expect(pool.defender).toContainDice('PDS', [6, 2])
  })

  it('does not add die when phase is not selected', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1 },
        abilities: {
          STRIKE_WING_AMBUSCADE: {
            isEnabled: true,
            uses: 1,
            phases: ['BOMBARDMENT'],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1, FIGHTER: 1 } },
    })

    t.advanceTo('AFB', 'ASSIGN_HITS', 0)
    const pool = t.dicePool()

    // Destroyer AFB: [9, 2] (no extra die — phases only includes BOMBARDMENT)
    expect(pool.attacker).toContainDice('DESTROYER', [9, 2])
  })
})
