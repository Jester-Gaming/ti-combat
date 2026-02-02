import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('EIDOLON', () => {
  it('mech participates in space combat with [8, 2] stats', () => {
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

    // Mech Z-Grav form: [8, 2]
    expect(dice.attacker).toContainDice('MECH', [8, 2])
  })

  it('multiple mechs all get [8, 2] stats', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 3 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.runTiming('START_OF_COMBAT')
    t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Each mech rolls [8, 2] — 3 mechs = 3 groups of [8, 2]
    const mechDice = dice.attacker.MECH!
    expect(mechDice).toHaveLength(3)
    for (const group of mechDice) {
      expect(group[0]).toBe(8)
      expect(group[1]).toBe(2)
    }
  })

  it('mech is a valid hit target in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.runTiming('START_OF_COMBAT')
    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 2)

    t.assignHits()

    expect(t.attacker.units.MECH).toBeUndefined()
    expect(t.attacker.units.CRUISER).toBeUndefined()
  })

  it('mech cannot sustain damage in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
        abilities: {
          SUSTAIN_DAMAGE: {
            spaceUnits: ['MECH'],
            spaceUnitPriority: ['MECH'],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.runTiming('START_OF_COMBAT')
    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Mech should NOT sustain — it's not in spaceUnits for SUSTAIN_DAMAGE
    expect(t.attacker.units.MECH![0].isDamaged).toBeFalsy()
  })

  it('mech has normal [6, 2] with sustain in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: {
          SUSTAIN_DAMAGE: {
            groundUnits: ['MECH'],
            groundUnitPriority: ['MECH'],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    // Eidolon has context: 'SPACE' so it doesn't fire in ground combat
    t.setPhase('GROUND_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Mech normal stats: [6, 2]
    expect(dice.attacker).toContainDice('MECH', [6, 2])

    // Sustain should work in ground combat
    t.setPhase('GROUND_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
  })

  it('does not affect non-Naaz-Rokha factions', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, MECH: 1 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.runTiming('START_OF_COMBAT')
    t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Mech should not roll dice for non-Naaz-Rokha factions
    expect(dice.attacker.MECH).toBeUndefined()
  })
})
