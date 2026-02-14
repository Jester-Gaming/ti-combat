import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('EIDOLON_MAXIMUM', () => {
  it('mech has [4, 4] stats in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Eidolon Maximum: [4, 4]
    expect(pool.attacker).toContainDice('MECH', [4, 4])
  })

  it('mech has [4, 4] stats in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Eidolon Maximum: [4, 4]
    expect(pool.attacker).toContainDice('MECH', [4, 4])
  })

  it('mech can sustain damage (unlike Z-Grav Eidolon)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
        abilities: {
          EIDOLON_MAXIMUM: true,
          SUSTAIN_DAMAGE: { spacePriority: ['MECH'] },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    // Mech should sustain — unlike Z-Grav which loses Sustain Damage
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
    expect(t.attacker.units.MECH).toHaveLength(1)
  })

  it('repairs mech at start of combat round', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
        abilities: {
          EIDOLON_MAXIMUM: true,
          SUSTAIN_DAMAGE: { spacePriority: ['MECH'] },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: mech sustains a hit
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)

    // Round 2: mech repairs at start of round
    t.advanceRound()
    expect(t.attacker.units.MECH![0].isDamaged).toBe(false)
  })

  it('overrides Z-Grav Eidolon transform', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Should NOT have Z-Grav [8, 2] stats
    expect(pool.attacker).toContainDice('MECH', [4, 4])
    // Eidolon ability should not have fired
    expect(t.abilityLog('EIDOLON')).toHaveLength(0)
  })

  it('mech is immune to bombardment hits', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1, DREADNOUGHT: 1 },
      },
      defender: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
    })

    // Advance past bombardment — defender receives 1 hit
    t.advanceTo('SPACE_CANNON_DEFENSE', undefined, { defender: 1 })

    // Mech should survive bombardment — only infantry can be hit
    expect(t.defender.units.MECH).toHaveLength(1)
    expect(t.defender.units.INFANTRY).toBeUndefined()
  })

  it('mech is immune to space cannon defense hits', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1, PDS: 1 } },
    })

    // Advance past SCD — attacker receives 1 hit
    t.advanceTo('GROUND_COMBAT', undefined, { attacker: 1 })

    // Mech should survive SCD — only infantry can be hit
    expect(t.attacker.units.MECH).toHaveLength(1)
    expect(t.attacker.units.INFANTRY).toBeUndefined()
  })

  it('mech can be destroyed by regular combat hits', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 2 })

    // Mech takes 2 hits: 1 sustain + 1 kill
    expect(t.attacker.units.MECH).toBeUndefined()
  })
})
