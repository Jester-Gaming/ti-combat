import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('PHOENIX_STANDARD', () => {
  it('galvanizes a surviving cruiser at end of space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'LAST_BASTION',
        units: { CRUISER: 3 },
        abilities: {
          PHOENIX_STANDARD: {
            isEnabled: true,
            spaceUnitPriority: ['CRUISER'],
          },
          PRE_GALVANIZED: { reinforcementTokens: 7 },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })
    t.advanceTo('COMPLETE')

    expect(t.state.currentPhase.meta).toBe('COMPLETE')
    expect(t.defender.units.CRUISER).toBeUndefined()
    expect(t.abilityLog('PHOENIX_STANDARD')).not.toHaveLength(0)
    expect(
      t.attacker.units.CRUISER!.some(u => u.subtypes?.includes('Galvanized')),
    ).toBe(true)
  })

  it('galvanizes a surviving infantry at end of ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3 },
        abilities: {
          PHOENIX_STANDARD: {
            isEnabled: true,
            groundUnitPriority: ['INFANTRY'],
          },
          PRE_GALVANIZED: { reinforcementTokens: 7 },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound({ defender: 1 })
    t.advanceTo('COMPLETE')

    expect(t.state.currentPhase.meta).toBe('COMPLETE')
    expect(t.defender.units.INFANTRY).toBeUndefined()
    expect(t.abilityLog('PHOENIX_STANDARD')).not.toHaveLength(0)
    expect(
      t.attacker.units.INFANTRY!.some(u => u.subtypes?.includes('Galvanized')),
    ).toBe(true)
  })

  it('fires when AFB ends combat by destroying the last defender unit', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'LAST_BASTION',
        units: { DESTROYER: 2 },
        abilities: {
          PHOENIX_STANDARD: {
            isEnabled: true,
            spaceUnitPriority: ['DESTROYER'],
          },
          PRE_GALVANIZED: { reinforcementTokens: 7 },
        },
      },
      defender: { faction: 'ARBOREC', units: { FIGHTER: 1 } },
    })

    // AFB: 2 destroyers roll at [9, 2] each = 4 dice → kill the fighter
    t.advanceTo('AFB')
    t.advanceRound({ defender: 1 })
    t.advanceTo('COMPLETE')

    expect(t.state.currentPhase.meta).toBe('COMPLETE')
    expect(t.defender.units.FIGHTER).toBeUndefined()
    expect(t.abilityLog('PHOENIX_STANDARD')).not.toHaveLength(0)
    expect(
      t.attacker.units.DESTROYER!.some(u => u.subtypes?.includes('Galvanized')),
    ).toBe(true)
  })

  it('falls through priority when the top type is gone', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'LAST_BASTION',
        units: { CRUISER: 3 },
        abilities: {
          PHOENIX_STANDARD: {
            isEnabled: true,
            // DESTROYER never existed — ability falls through to CRUISER
            spaceUnitPriority: ['DESTROYER', 'CRUISER'],
          },
          PRE_GALVANIZED: { reinforcementTokens: 7 },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })
    t.advanceTo('COMPLETE')

    expect(t.abilityLog('PHOENIX_STANDARD')).not.toHaveLength(0)
    expect(
      t.attacker.units.CRUISER!.some(u => u.subtypes?.includes('Galvanized')),
    ).toBe(true)
  })

  it('does not fire when reinforcement tokens are zero', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'LAST_BASTION',
        units: { CRUISER: 3 },
        abilities: {
          PHOENIX_STANDARD: {
            isEnabled: true,
            spaceUnitPriority: ['CRUISER'],
          },
          PRE_GALVANIZED: { reinforcementTokens: 0 },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })
    t.advanceTo('COMPLETE')

    expect(t.defender.units.CRUISER).toBeUndefined()
    expect(t.abilityLog('PHOENIX_STANDARD')).toHaveLength(0)
    expect(
      t.attacker.units.CRUISER!.some(u => u.subtypes?.includes('Galvanized')),
    ).toBe(false)
  })

  it('does not fire when no prioritized unit type survives', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'LAST_BASTION',
        units: { CRUISER: 2 },
        abilities: {
          PHOENIX_STANDARD: {
            isEnabled: true,
            spaceUnitPriority: ['CRUISER'],
          },
          PRE_GALVANIZED: { reinforcementTokens: 7 },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    // Defender kills both attacker cruisers; nothing left to galvanize
    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 2 })
    t.advanceTo('COMPLETE')

    expect(t.attacker.units.CRUISER).toBeUndefined()
    expect(t.abilityLog('PHOENIX_STANDARD')).toHaveLength(0)
  })

  it('consumes a reinforcement token when galvanizing', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'LAST_BASTION',
        units: { CRUISER: 3 },
        abilities: {
          PHOENIX_STANDARD: {
            isEnabled: true,
            spaceUnitPriority: ['CRUISER'],
          },
          PRE_GALVANIZED: { reinforcementTokens: 3 },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })
    t.advanceTo('COMPLETE')

    expect(t.abilityLog('PHOENIX_STANDARD')).not.toHaveLength(0)
    expect(t.state.abilities.attacker.PRE_GALVANIZED.reinforcementTokens).toBe(
      2,
    )
  })
})
