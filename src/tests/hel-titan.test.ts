import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('HEL_TITAN', () => {
  it('PDS participates in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
      defender: {
        faction: 'TITANS_OF_UL',
        units: { PDS: 1, INFANTRY: 1 },
      },
    })

    t.setPhase('GROUND_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Hel-Titan I: Combat [7, 1]
    expect(dice.defender).toContainDice('PDS', [7, 1])
  })

  it('PDS is a valid hit target in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
      },
      defender: {
        faction: 'TITANS_OF_UL',
        units: { PDS: 1 },
      },
    })

    t.setPhase('GROUND_COMBAT', 'ASSIGN_HITS')
    t.addHits('defender', 1)

    t.assignHits()
    expect(t.defender.units.PDS).toBeUndefined()
  })

  it('PDS does not participate in ground combat for non-Titan factions', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 1 },
      },
    })

    t.setPhase('GROUND_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // PDS should not roll dice for non-Titan factions
    expect(dice.defender.PDS).toBeUndefined()
  })
})
