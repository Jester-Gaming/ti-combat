import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ASSIMILATOR_Z + QUIETUS', () => {
  it('disables opponent sustain but Nekro keeps sustain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, DREADNOUGHT: 1 },
        abilities: { NEKRO_FLAGSHIP_QUIETUS: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: { NEKRO_FLAGSHIP_QUIETUS: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 2, defender: 2 })

    // Opponent dreadnought could not sustain — destroyed
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()

    // Nekro flagship sustained — keeps sustain
    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })

  it('fires without error when Alastor is destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: { NEKRO_FLAGSHIP_QUIETUS: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    // Round 1: sustain
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)

    // Round 2: destroyed → Quietus AFTER_DESTROY fires
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
  })

  it('Alastor destroyed — Crimson regains sustain, Nekro cannot', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        // WAR_SUN (cost 12) > FLAGSHIP (cost 8) — flagship dies first
        units: { FLAGSHIP: 1, WAR_SUN: 2 },
        abilities: { NEKRO_FLAGSHIP_QUIETUS: true, QUIETUS: true },
      },
      defender: {
        faction: 'CRIMSON_REBELLION',
        units: { FLAGSHIP: 1, DREADNOUGHT: 1, CRUISER: 2 },
        abilities: { NEKRO_FLAGSHIP_QUIETUS: true, QUIETUS: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    // Round 1: Alastor takes 1 hit → destroyed (can't sustain, Crimson Quietus active)
    // NEKRO_FLAGSHIP_QUIETUS DESTROY fires → lifts restrictions on Crimson
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.FLAGSHIP).toBeUndefined()

    // Round 2: Crimson dreadnought sustains (Nekro Quietus lifted)
    // Nekro WAR_SUN can't sustain (Crimson Quietus still active) → destroyed
    t.advanceRound({ attacker: 1, defender: 1 })

    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.attacker.units.WAR_SUN).toHaveLength(1)
  })

  it('Crimson flagship destroyed — Nekro regains sustain, Crimson cannot', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, DREADNOUGHT: 1, CRUISER: 2 },
        abilities: { NEKRO_FLAGSHIP_QUIETUS: true, QUIETUS: true },
      },
      defender: {
        faction: 'CRIMSON_REBELLION',
        // WAR_SUN (cost 12) > FLAGSHIP (cost 8) — flagship dies first
        units: { FLAGSHIP: 1, WAR_SUN: 2 },
        abilities: { NEKRO_FLAGSHIP_QUIETUS: true, QUIETUS: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    // Round 1: Crimson flagship takes 1 hit → destroyed (can't sustain, Nekro Quietus active)
    // QUIETUS DESTROY fires → lifts restrictions on Nekro
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.FLAGSHIP).toBeUndefined()

    // Round 2: Nekro dreadnought sustains (Crimson Quietus lifted)
    // Crimson WAR_SUN can't sustain (Nekro Quietus still active) → destroyed
    t.advanceRound({ attacker: 1, defender: 1 })

    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.defender.units.WAR_SUN).toHaveLength(1)
  })
})
