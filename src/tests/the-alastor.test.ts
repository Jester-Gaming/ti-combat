import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('THE_ALASTOR', () => {
  it('infantry participates in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, INFANTRY: 2 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.runTiming('START_OF_COMBAT')
    t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Infantry: [8, 1]
    expect(dice.attacker).toContainDice('INFANTRY', [8, 1])
  })

  it('mech participates in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, MECH: 1 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.runTiming('START_OF_COMBAT')
    t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Nekro Mordred mech: [6, 1]
    expect(dice.attacker).toContainDice('MECH', [6, 1])
  })

  it('infantry is a valid hit target in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, INFANTRY: 1 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.runTiming('START_OF_COMBAT')
    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    // 2 hits: 1 absorbed by flagship sustain, 1 destroys infantry
    t.addHits('attacker', 2)

    t.assignHits()
    expect(t.attacker.units.INFANTRY).toBeUndefined()
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)
  })

  it('mech can sustain damage in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, MECH: 1 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.runTiming('START_OF_COMBAT')
    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    // 2 hits: both units sustain
    t.addHits('attacker', 2)
    t.runTiming('BEFORE_ASSIGN_HITS')

    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
  })

  it('does not affect non-Nekro factions', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, INFANTRY: 2 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.runTiming('START_OF_COMBAT')
    t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Infantry should not roll dice for non-Nekro factions
    expect(dice.attacker.INFANTRY).toBeUndefined()
  })
})
