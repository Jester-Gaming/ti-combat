import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('RAISE_THE_STANDARD', () => {
  it('galvanizes a surviving cruiser at end of space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: {
          RAISE_THE_STANDARD: {
            isEnabled: true,
            spaceUnitPriority: ['CRUISER'],
          },
          PRE_GALVANIZED: { reinforcementTokens: 7 },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })
    t.advanceTo('COMPLETE')

    expect(t.isFinished()).toBe(true)
    expect(t.defender.units.CRUISER).toBeUndefined()
    expect(t.abilityLog('RAISE_THE_STANDARD')).not.toHaveLength(0)
    expect(
      t.attacker.units.CRUISER!.some(u => u.subtypes?.includes('Galvanized')),
    ).toBe(true)
    expect(t.state.abilities.attacker.RAISE_THE_STANDARD.uses).toBe(0)
  })

  it('galvanizes a surviving infantry at end of ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
        abilities: {
          RAISE_THE_STANDARD: {
            isEnabled: true,
            groundUnitPriority: ['INFANTRY'],
          },
          PRE_GALVANIZED: { reinforcementTokens: 7 },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ defender: 1 })
    t.advanceTo('COMPLETE')

    expect(t.isFinished()).toBe(true)
    expect(t.defender.units.INFANTRY).toBeUndefined()
    expect(t.abilityLog('RAISE_THE_STANDARD')).not.toHaveLength(0)
    expect(
      t.attacker.units.INFANTRY!.some(u => u.subtypes?.includes('Galvanized')),
    ).toBe(true)
  })

  it('falls through priority when the top type is gone', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: {
          RAISE_THE_STANDARD: {
            isEnabled: true,
            spaceUnitPriority: ['DESTROYER', 'CRUISER'],
          },
          PRE_GALVANIZED: { reinforcementTokens: 7 },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })
    t.advanceTo('COMPLETE')

    expect(t.abilityLog('RAISE_THE_STANDARD')).not.toHaveLength(0)
    expect(
      t.attacker.units.CRUISER!.some(u => u.subtypes?.includes('Galvanized')),
    ).toBe(true)
  })

  it('does not fire when reinforcement tokens are zero', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: {
          RAISE_THE_STANDARD: {
            isEnabled: true,
            spaceUnitPriority: ['CRUISER'],
          },
          PRE_GALVANIZED: { reinforcementTokens: 0 },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })
    t.advanceTo('COMPLETE')

    expect(t.defender.units.CRUISER).toBeUndefined()
    expect(t.abilityLog('RAISE_THE_STANDARD')).toHaveLength(0)
    expect(
      t.attacker.units.CRUISER!.some(u => u.subtypes?.includes('Galvanized')),
    ).toBe(false)
  })

  it('does not fire when no prioritized unit type survives', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          RAISE_THE_STANDARD: {
            isEnabled: true,
            spaceUnitPriority: ['CRUISER'],
          },
          PRE_GALVANIZED: { reinforcementTokens: 7 },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 2 })
    t.advanceTo('COMPLETE')

    expect(t.attacker.units.CRUISER).toBeUndefined()
    expect(t.abilityLog('RAISE_THE_STANDARD')).toHaveLength(0)
  })

  it('consumes a reinforcement token when galvanizing', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: {
          RAISE_THE_STANDARD: {
            isEnabled: true,
            spaceUnitPriority: ['CRUISER'],
          },
          PRE_GALVANIZED: { reinforcementTokens: 3 },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })
    t.advanceTo('COMPLETE')

    expect(t.abilityLog('RAISE_THE_STANDARD')).not.toHaveLength(0)
    expect(t.state.abilities.attacker.PRE_GALVANIZED.reinforcementTokens).toBe(
      2,
    )
  })
})
