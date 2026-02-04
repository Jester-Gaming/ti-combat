import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('Alarum', () => {
  it('adds infantry at the end of a ground combat round', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'RAL_NEL',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: { ALARUM: { infantryAvailable: 4 } },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.setPhase('GROUND_COMBAT', 'END')
    t.runTiming('END_OF_COMBAT_ROUND')

    // Should add 2 infantry (min of 2 and 4 available)
    expect(t.attacker.units.INFANTRY).toHaveLength(3)

    t.setPhase('GROUND_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')
    expect(dice.attacker).toContainDice('INFANTRY', [8, 1])
    expect(dice.attacker.INFANTRY).toHaveLength(3)
  })

  it('adds only available infantry when less than 2', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'RAL_NEL',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: { ALARUM: { infantryAvailable: 1 } },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.setPhase('GROUND_COMBAT', 'END')
    t.runTiming('END_OF_COMBAT_ROUND')

    // Should add only 1 infantry
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })

  it('does not add infantry when none available', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'RAL_NEL',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: { ALARUM: { infantryAvailable: 0 } },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.setPhase('GROUND_COMBAT', 'END')
    t.runTiming('END_OF_COMBAT_ROUND')

    expect(t.attacker.units.INFANTRY).toHaveLength(1)
  })

  it('decrements available infantry after each round', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'RAL_NEL',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: { ALARUM: { infantryAvailable: 3 } },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 4 } },
    })

    // First round: adds 2, leaves 1 available
    t.setPhase('GROUND_COMBAT', 'END')
    t.runTiming('END_OF_COMBAT_ROUND')
    expect(t.attacker.units.INFANTRY).toHaveLength(3)

    // Second round: adds 1 (only 1 left), leaves 0 available
    t.runTiming('END_OF_COMBAT_ROUND')
    expect(t.attacker.units.INFANTRY).toHaveLength(4)

    // Third round: no more available
    t.runTiming('END_OF_COMBAT_ROUND')
    expect(t.attacker.units.INFANTRY).toHaveLength(4)
  })

  it('each mech adds 2 infantry independently', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'RAL_NEL',
        units: { MECH: 2, INFANTRY: 1 },
        abilities: { ALARUM: { infantryAvailable: 6 } },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 6 } },
    })

    // 2 mechs each add 2 infantry, counter decreases by 4
    t.setPhase('GROUND_COMBAT', 'END')
    t.runTiming('END_OF_COMBAT_ROUND')
    expect(t.attacker.units.INFANTRY).toHaveLength(5)

    // 2 remaining: each mech wants 2 but only 2 left total
    // First mech adds 2, counter hits 0, second mech can't fire
    t.runTiming('END_OF_COMBAT_ROUND')
    expect(t.attacker.units.INFANTRY).toHaveLength(7)

    // No more available
    t.runTiming('END_OF_COMBAT_ROUND')
    expect(t.attacker.units.INFANTRY).toHaveLength(7)
  })
})
