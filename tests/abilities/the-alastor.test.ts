import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('THE_ALASTOR', () => {
  it('infantry participates in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, INFANTRY: 2 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Infantry: [8, 1]
    expect(pool.attacker).toContainDice('INFANTRY', [8, 1])
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

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Nekro Mordred mech: [6, 1]
    expect(pool.attacker).toContainDice('MECH', [6, 1])
  })

  it('infantry is a valid hit target in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, INFANTRY: 1 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    // 2 hits: 1 absorbed by flagship sustain, 1 destroys infantry
    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 2 })

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
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    // 2 hits: both units sustain
    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 2 })

    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
  })
})
