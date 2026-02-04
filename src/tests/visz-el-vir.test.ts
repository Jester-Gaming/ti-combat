import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('VISZ_EL_VIR', () => {
  it('mechs roll 1 additional die in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { FLAGSHIP: 1, MECH: 1 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.runTiming('START_OF_COMBAT')
    t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Mech Z-Grav form: [8, 2] + 1 die from Visz El Vir = [8, 3]
    expect(dice.attacker).toContainDice('MECH', [8, 3])
  })

  it('each mech gets +1 die with multiple mechs', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { FLAGSHIP: 1, MECH: 3 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.runTiming('START_OF_COMBAT')
    t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Each mech: [8, 2] + 1 = [8, 3]
    const mechDice = dice.attacker.MECH!
    expect(mechDice).toHaveLength(3)
    for (const group of mechDice) {
      expect(group[0]).toBe(8)
      expect(group[1]).toBe(3)
    }
  })

  it('mechs roll 1 additional die in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { FLAGSHIP: 1, MECH: 1, INFANTRY: 1 },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.setPhase('GROUND_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Mech normal stats: [6, 2] + 1 die from Visz El Vir = [6, 3]
    expect(dice.attacker).toContainDice('MECH', [6, 3])
  })

  it('does not fire without flagship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.runTiming('START_OF_COMBAT')
    t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Mech Z-Grav form: [8, 2] — no extra die without flagship
    expect(dice.attacker).toContainDice('MECH', [8, 2])
  })
})
