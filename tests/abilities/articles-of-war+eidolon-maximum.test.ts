import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ARTICLES_OF_WAR + EIDOLON_MAXIMUM', () => {
  it('Eidolon Maximum stat changes survive AoW ability stripping', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
        abilities: {
          ARTICLES_OF_WAR: true,
          EIDOLON_MAXIMUM: true,
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Eidolon Maximum: [4, 4]
    expect(pool.attacker).toContainDice('MECH', [4, 4])
  })

  it('Eidolon Maximum auto-repair still works under AoW', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1, CRUISER: 2 },
        abilities: {
          ARTICLES_OF_WAR: true,
          EIDOLON_MAXIMUM: true,
          SUSTAIN_DAMAGE: {
            spacePriority: ['MECH'],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: mech takes a hit, sustains
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)

    // Round 2: EM repairs mech at start of round
    t.advanceRound()
    expect(t.attacker.units.MECH![0].isDamaged).toBe(false)
  })

  it('mech retains Sustain Damage in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: {
          ARTICLES_OF_WAR: true,
          EIDOLON_MAXIMUM: true,
          SUSTAIN_DAMAGE: {
            groundPriority: ['MECH'],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    // Sustain Damage preserved by AoW
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
    expect(t.attacker.units.MECH).toHaveLength(1)
  })
})
