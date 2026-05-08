import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('CAVALRY + VISCOUNT_UNLENN', () => {
  it('both select plain Cruiser — affect two different units', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'CRUISER' },
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'CRUISER' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // Both abilities fired
    expect(t.abilityLog('CAVALRY')).not.toHaveLength(0)
    expect(t.abilityLog('VISCOUNT_UNLENN')).not.toHaveLength(0)

    const pool = t.dicePool()

    // Cavalry Cruiser gets Nomad flagship stats, Viscount on different Cruiser
    // Cavalry and Viscount on separate Cruisers — Viscount adds 1 die to its Cruiser
    // Base Cruiser: [7, 1], Viscount adds 1 die: [7, 2]
    expect(pool.attacker).not.toContainDice('CRUISER', [7, 3])
    expect(pool.attacker).toContainDice('CRUISER', [7, 2])
  })

  it('only Cavalry fires when single Cruiser and Cavalry is first', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'CRUISER' },
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'CRUISER' },
          ABILITY_ORDER: {
            startOfCombat: [['CAVALRY'], ['VISCOUNT_UNLENN']],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // Cavalry takes the only Cruiser, Viscount has no plain Cruiser left
    expect(t.abilityLog('CAVALRY')).not.toHaveLength(0)
    expect(t.abilityLog('VISCOUNT_UNLENN')).toHaveLength(0)
  })

  it('only Viscount fires when single Cruiser and Viscount is first', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'CRUISER' },
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'CRUISER' },
          ABILITY_ORDER: {
            startOfCombat: [['VISCOUNT_UNLENN'], ['CAVALRY']],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // Viscount takes the only Cruiser, Cavalry has no plain Cruiser left
    expect(t.abilityLog('VISCOUNT_UNLENN')).not.toHaveLength(0)
    expect(t.abilityLog('CAVALRY')).toHaveLength(0)
  })

  it('Cavalry targets Cruiser:Viscount — both affect the same unit', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'CRUISER:Viscount' },
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'CRUISER' },
          ABILITY_ORDER: {
            startOfCombat: [['VISCOUNT_UNLENN'], ['CAVALRY']],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('CAVALRY')).not.toHaveLength(0)
    expect(t.abilityLog('VISCOUNT_UNLENN')).not.toHaveLength(0)

    const pool = t.dicePool()

    // Viscount Cruiser [7, 2] then Cavalry on that unit = [7, 3]
    expect(pool.attacker).toContainDice('CRUISER', [7, 3])
  })

  it('Viscount targets Cruiser:Cavalry — both affect the same unit', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'CRUISER' },
          VISCOUNT_UNLENN: {
            isEnabled: true,
            unitType: 'CRUISER:Cavalry',
          },
          ABILITY_ORDER: {
            startOfCombat: [['CAVALRY'], ['VISCOUNT_UNLENN']],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // Both abilities fired on the same unit
    expect(t.abilityLog('CAVALRY')).not.toHaveLength(0)
    expect(t.abilityLog('VISCOUNT_UNLENN')).not.toHaveLength(0)

    const pool = t.dicePool()

    // Cavalry Cruiser [7, 2] + 1 from Viscount = [7, 3]
    expect(pool.attacker).toContainDice('CRUISER', [7, 3])
  })
})
