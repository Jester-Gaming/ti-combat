import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('MATRIARCH', () => {
  it('fighters participate in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        units: { FLAGSHIP: 1, FIGHTER: 2, INFANTRY: 1 },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.runTiming('START_OF_COMBAT')
    t.setPhase('GROUND_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Hybrid Crystal Fighter I: [8, 1]
    expect(dice.attacker).toContainDice('FIGHTER', [8, 1])
  })

  it('fighters are valid hit targets in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        units: { FLAGSHIP: 1, FIGHTER: 1, INFANTRY: 1 },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.runTiming('START_OF_COMBAT')
    t.setPhase('GROUND_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 2)

    t.assignHits()
    expect(t.attacker.units.FIGHTER).toBeUndefined()
    expect(t.attacker.units.INFANTRY).toBeUndefined()
  })

  it('fighters are assigned hits after priority units', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        units: { FLAGSHIP: 1, FIGHTER: 2, INFANTRY: 2 },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.runTiming('START_OF_COMBAT')
    t.setPhase('GROUND_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 3)

    t.assignHits()
    expect(t.attacker.units.INFANTRY).toBeUndefined()
    expect(t.attacker.units.FIGHTER).toHaveLength(1)
  })

  it('does not affect ground combat without flagship', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        units: { FIGHTER: 2, INFANTRY: 1 },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.runTiming('START_OF_COMBAT')
    t.setPhase('GROUND_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Fighters should not roll dice without flagship present
    expect(dice.attacker.FIGHTER).toBeUndefined()
  })

  it('does not affect non-Naalu factions', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { FIGHTER: 2, INFANTRY: 1 },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.runTiming('START_OF_COMBAT')
    t.setPhase('GROUND_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Fighters should not roll dice for non-Naalu factions
    expect(dice.attacker.FIGHTER).toBeUndefined()
  })

  it('does not affect space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        units: { FLAGSHIP: 1, FIGHTER: 2 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Fighters participate in space combat normally (not via Matriarch)
    expect(dice.attacker).toContainDice('FIGHTER', [8, 1])
  })
})
