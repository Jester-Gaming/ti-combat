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

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1 })

    // Dreadnought sustained then got repaired by Dynamo
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
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

    t.advanceTo('SPACE_COMBAT')
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

    t.advanceTo('SPACE_COMBAT')
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

    t.advanceTo('SPACE_COMBAT')
    // 2 hits: dreadnought sustains + repaired, remaining hit destroys cruiser
    // Dreadnought does NOT sustain a second time in the same pool
    t.advanceRound({ attacker: 2 })

    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
    expect(t.attacker.units.CRUISER).toBeUndefined()
    // Only 1 Dynamo use consumed (not 2)
    expect(t.abilityLog('DYNAMO')).not.toHaveLength(0)
  })

  it('flagship destruction stops Dynamo', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'EMPYREAN',
        units: { FLAGSHIP: 1, DREADNOUGHT: 1 },
        abilities: {
          DYNAMO: { uses: 10 },
          // Flagship sustains first so Direct Hit targets it
          SUSTAIN_DAMAGE: {
            spacePriority: [
              ['FLAGSHIP', true],
              ['DREADNOUGHT', true],
            ],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    // 1 hit: flagship sustains → Dynamo repairs → Direct Hit kills flagship
    // DESTROY handler disables Dynamo
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.abilityLog('DYNAMO')).not.toHaveLength(0)

    // Round 2: dreadnought sustains — NOT repaired (Dynamo disabled)
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })
})
