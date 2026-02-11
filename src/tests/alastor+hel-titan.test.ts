import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('THE_ALASTOR + HEL_TITAN', () => {
  it('PDS participates in space combat when Nekro has Hel-Titan', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, PDS: 1 },
        abilities: { NEKRO_UNIT_TITANS_OF_UL_PDS: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // PDS (Hel-Titan II): [6, 1]
    expect(pool.attacker).toContainDice('PDS', [6, 1])
  })

  it('PDS is a valid hit target in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, PDS: 1 },
        abilities: { NEKRO_UNIT_TITANS_OF_UL_PDS: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    // 3 hits: 1 absorbed by flagship sustain, 1 absorbed by PDS sustain, 1 destroys PDS
    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 3 })

    expect(t.attacker.units.PDS).toBeUndefined()
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)
  })

  it('PDS participates in ground combat when Nekro has Hel-Titan', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { INFANTRY: 1, PDS: 1 },
        abilities: { NEKRO_UNIT_TITANS_OF_UL_PDS: true },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // PDS (Hel-Titan II): [6, 1]
    expect(pool.attacker).toContainDice('PDS', [6, 1])
  })
})
