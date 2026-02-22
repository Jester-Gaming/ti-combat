import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('DIMENSIONAL_SPLICER + REFLECTIVE_SHIELDING', () => {
  it('full chain: Dimensional Splicer → sustain → Reflective Shielding → attacker sustains', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'GHOSTS_OF_CREUSS',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: { DIMENSIONAL_SPLICER: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: { REFLECTIVE_SHIELDING: true },
      },
    })

    // DS fires at START_OF_COMBAT → hit auto-assigned before DICE_ROLL
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // Defender's dreadnought sustained the Dimensional Splicer hit
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)

    // Attacker's dreadnought sustained 1 Reflective Shielding hit
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)

    // Attacker's cruiser destroyed by remaining Reflective Shielding hit
    expect(t.attacker.units.CRUISER).toBeUndefined()

    // Verify ability chain fired
    expect(t.abilityLog('DIMENSIONAL_SPLICER').length).toBeGreaterThan(0)
    expect(t.abilityLog('REFLECTIVE_SHIELDING').length).toBeGreaterThan(0)
  })

  it('attacker sustains all Reflective Shielding hits when enough sustain ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'GHOSTS_OF_CREUSS',
        units: { DREADNOUGHT: 1, WAR_SUN: 1 },
        abilities: { DIMENSIONAL_SPLICER: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: { REFLECTIVE_SHIELDING: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // Defender's dreadnought sustained the Dimensional Splicer hit
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)

    // Both attacker ships sustain the 2 Reflective Shielding hits — no ships destroyed
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.attacker.units.WAR_SUN).toHaveLength(1)
    expect(t.attacker.units.WAR_SUN![0].isDamaged).toBe(true)
  })

  it('Reflective Shielding does not fire when defender cannot sustain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'GHOSTS_OF_CREUSS',
        units: { CRUISER: 1 },
        abilities: { DIMENSIONAL_SPLICER: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { REFLECTIVE_SHIELDING: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // Defender's cruiser destroyed (no sustain) → no Reflective Shielding trigger
    expect(t.defender.units.CRUISER).toHaveLength(1)

    // Attacker unaffected
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })
})
