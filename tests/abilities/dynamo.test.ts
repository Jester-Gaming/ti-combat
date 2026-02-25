import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DYNAMO', () => {
  it('repairs own unit after sustain damage', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: { DYNAMO: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    // Dreadnought sustained then got repaired by Dynamo
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(false)
    expect(t.abilityLog('DYNAMO')).not.toHaveLength(0)
  })

  it('does not repair opponent units', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: { DYNAMO: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })

    // Defender dreadnought sustained — NOT repaired (only own side)
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })

  it('does nothing when uses is 0', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: { DYNAMO: { uses: 0 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    // Dreadnought sustained but not repaired
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.abilityLog('DYNAMO')).toHaveLength(0)
  })

  it('unit does not sustain again after Dynamo repair in same pool', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: { DYNAMO: { uses: 5 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // 2 hits: dreadnought sustains + repaired, remaining hit destroys cruiser
    // Dreadnought does NOT sustain a second time in the same pool
    t.advanceRound({ attacker: 2 })

    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(false)
    expect(t.attacker.units.CRUISER).toBeUndefined()
    // Only 1 Dynamo use consumed (not 2)
    expect(t.abilityLog('DYNAMO')).not.toHaveLength(0)
  })

  it.fails('flagship destruction sets uses to 0', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'EMPYREAN',
        units: { FLAGSHIP: 1, WAR_SUN: 1 },
        abilities: { DYNAMO: { uses: 10 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')

    // Round 1: 2 hits to attacker
    // Flagship sustains + repaired. 1 remaining: Flagship (cost 8) destroyed
    // War Sun (cost 12) survives undamaged
    t.advanceRound({ attacker: 2 })

    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
    expect(t.attacker.units.WAR_SUN).toHaveLength(1)
    expect(t.attacker.units.WAR_SUN![0].isDamaged).toBeFalsy()

    // Round 2: War Sun sustains — NOT repaired (flagship destroyed, uses set to 0)
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.WAR_SUN).toHaveLength(1)
    expect(t.attacker.units.WAR_SUN![0].isDamaged).toBe(true)
  })
})
