import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('EIDOLON', () => {
  it('mech participates in space combat with [8, 2] stats', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Mech Z-Grav form: [8, 2]
    expect(pool.attacker).toContainDice('MECH', [8, 2])
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

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Each mech rolls [8, 2] — 3 mechs = 3 groups of [8, 2]
    const mechDice = pool.attacker.MECH!
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
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 2 })

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
            spacePriority: ['MECH'],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    // Mech should NOT sustain — it's not in spacePriority for SUSTAIN_DAMAGE
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
            groundPriority: ['MECH'],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    // Eidolon has context: 'SPACE' so it doesn't fire in ground combat
    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })
    const pool = t.dicePool()!

    // Mech normal stats: [6, 2]
    expect(pool.attacker).toContainDice('MECH', [6, 2])

    // Sustain should work in ground combat
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

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Mech should not roll dice for non-Naaz-Rokha factions
    expect(pool.attacker.MECH).toBeUndefined()
  })
})
