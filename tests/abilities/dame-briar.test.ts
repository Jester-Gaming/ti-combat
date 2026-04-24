import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DAME_BRIAR', () => {
  it('galvanizes a surviving own cruiser after a cruiser dies', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'LAST_BASTION',
        units: { CRUISER: 2 },
        abilities: {
          DAME_BRIAR: { isEnabled: true, spaceUnitType: 'CRUISER' },
          PRE_GALVANIZED: { reinforcementTokens: 7 },
        },
      },
      defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Two hits from dreadnoughts destroy a cruiser (after sustain on the other)
    t.advanceRound({ attacker: 1 })

    // Verify cruiser death before asserting ability behavior
    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.abilityLog('DAME_BRIAR')).not.toHaveLength(0)
    expect(t.attacker.units.CRUISER![0].subtypes).toContain('Galvanized')

    // Round 2: the galvanized cruiser rolls [7, 2]
    t.advanceRound()
    const pool = t.dicePool()
    expect(pool.attacker).toContainDice('CRUISER', [7, 2])
  })

  it('galvanizes a surviving own infantry after one dies in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 2 },
        abilities: {
          DAME_BRIAR: { isEnabled: true, groundUnitType: 'INFANTRY' },
          PRE_GALVANIZED: { reinforcementTokens: 7 },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.INFANTRY).toHaveLength(1)
    expect(t.abilityLog('DAME_BRIAR')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY![0].subtypes).toContain('Galvanized')
  })

  it('does not fire when no own unit is destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'LAST_BASTION',
        units: { CRUISER: 2 },
        abilities: {
          DAME_BRIAR: { isEnabled: true, spaceUnitType: 'CRUISER' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.attacker.units.CRUISER).toHaveLength(2)
    expect(t.abilityLog('DAME_BRIAR')).toHaveLength(0)
  })

  it('does not fire when only opponent unit is destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'LAST_BASTION',
        units: { CRUISER: 2 },
        abilities: {
          DAME_BRIAR: { isEnabled: true, spaceUnitType: 'CRUISER' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.CRUISER).toBeUndefined()
    expect(t.abilityLog('DAME_BRIAR')).toHaveLength(0)
  })

  it('does not galvanize when reinforcement tokens are zero', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'LAST_BASTION',
        units: { CRUISER: 2 },
        abilities: {
          DAME_BRIAR: { isEnabled: true, spaceUnitType: 'CRUISER' },
          PRE_GALVANIZED: { reinforcementTokens: 0 },
        },
      },
      defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.abilityLog('DAME_BRIAR')).toHaveLength(0)
    expect(t.attacker.units.CRUISER![0].subtypes).toBeUndefined()
  })

  it('consumes a reinforcement token when galvanizing', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'LAST_BASTION',
        units: { CRUISER: 2 },
        abilities: {
          DAME_BRIAR: { isEnabled: true, spaceUnitType: 'CRUISER' },
          PRE_GALVANIZED: { reinforcementTokens: 3 },
        },
      },
      defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1 })

    expect(t.abilityLog('DAME_BRIAR')).not.toHaveLength(0)
    expect(t.state.attacker.abilities.PRE_GALVANIZED.reinforcementTokens).toBe(
      2,
    )
  })
})
