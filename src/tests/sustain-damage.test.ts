import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('SUSTAIN_DAMAGE', () => {
  it('absorbs 1 hit and marks unit as damaged', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)

    // Unit survives
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
  })

  it('does not trigger when there are no pending hits', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 0 })

    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
  })

  it('does not trigger on already damaged unit', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 1 } },
    })

    // First round: sustain 1 hit
    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)

    // Second round: another hit — can't sustain again, unit is destroyed
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
  })

  it('multiple units sustain independently', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 2 } },
      defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 2 })

    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.defender.units.DREADNOUGHT![1].isDamaged).toBe(true)

    // Both survive
    expect(t.defender.units.DREADNOUGHT).toHaveLength(2)
  })

  it('sustains by default priority (Dreadnought before War Sun)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { WAR_SUN: 1, DREADNOUGHT: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })

    // Default priority: DREADNOUGHT comes before WAR_SUN
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.defender.units.WAR_SUN![0].isDamaged).toBeFalsy()
  })

  it('respects custom priority order', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { WAR_SUN: 1, DREADNOUGHT: 1 },
        abilities: {
          SUSTAIN_DAMAGE: {
            spacePriority: ['WAR_SUN', 'DREADNOUGHT'],
          },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })

    // Custom priority: WAR_SUN before DREADNOUGHT
    expect(t.defender.units.WAR_SUN![0].isDamaged).toBe(true)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
  })

  it('does not sustain for excluded unit type', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: {
          SUSTAIN_DAMAGE: {
            spacePriority: ['WAR_SUN', 'FLAGSHIP'],
          },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })

    // Dreadnought excluded from spacePriority — doesn't sustain, destroyed
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
  })

  it('works in ground combat with mech', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
      defender: { faction: 'ARBOREC', units: { MECH: 1 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.MECH![0].isDamaged).toBe(true)

    expect(t.defender.units.MECH).toHaveLength(1)
  })

  it('sustains only up to number of pending hits', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 2 } },
    })

    // Only 1 hit for 2 dreadnoughts
    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })

    // Only one sustains
    const dn = t.defender.units.DREADNOUGHT!
    const damagedCount = dn.filter(u => u.isDamaged).length
    expect(damagedCount).toBe(1)

    // Both survive
    expect(t.defender.units.DREADNOUGHT).toHaveLength(2)
  })

  it('unit is destroyed when hits exceed sustain capacity', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 2 } },
      defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 2 })

    // Dreadnought sustained 1 hit but still destroyed by 2nd
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
  })

  it('both sides sustain independently', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { DREADNOUGHT: 1 } },
      defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1, defender: 1 })

    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)

    // Both survive
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
  })
})
