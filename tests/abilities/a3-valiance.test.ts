import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('A3_VALIANCE', () => {
  it('galvanizes up to 3 infantry when a galvanized mech is destroyed', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { MECH: 1, INFANTRY: 3 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['MECH', 1]],
            reinforcementTokens: 3,
          },
          SUSTAIN_DAMAGE: { groundPriority: [['MECH:Galvanized', true]] },
          UNIT_PRIORITY: {
            groundUnitPriority: [['MECH:Galvanized'], ['INFANTRY']],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 4 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    // 2 hits: sustain absorbs 1, assigned hit destroys the damaged mech.
    t.advanceRound({ attacker: 2 })

    expect(t.attacker.units.MECH).toBeUndefined()
    expect(t.abilityLog('A3_VALIANCE')).not.toHaveLength(0)

    const infantry = t.attacker.units.INFANTRY ?? []
    expect(infantry).toHaveLength(3)
    const galvanized = infantry.filter(u => u.subtypes?.includes('Galvanized'))
    expect(galvanized).toHaveLength(3)
    expect(t.state.attacker.abilities.PRE_GALVANIZED.reinforcementTokens).toBe(
      0,
    )
  })

  it('does not fire when a non-galvanized mech is destroyed', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { MECH: 1, INFANTRY: 3 },
        abilities: {
          SUSTAIN_DAMAGE: { groundPriority: [['MECH', true]] },
          UNIT_PRIORITY: { groundUnitPriority: [['MECH'], ['INFANTRY']] },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 4 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 2 })

    expect(t.attacker.units.MECH).toBeUndefined()
    expect(t.abilityLog('A3_VALIANCE')).toHaveLength(0)

    const infantry = t.attacker.units.INFANTRY ?? []
    const galvanized = infantry.filter(u => u.subtypes?.includes('Galvanized'))
    expect(galvanized).toHaveLength(0)
  })

  it('clamps to available non-galvanized infantry', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { MECH: 1, INFANTRY: 2 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['MECH', 1]],
            reinforcementTokens: 3,
          },
          SUSTAIN_DAMAGE: { groundPriority: [['MECH:Galvanized', true]] },
          UNIT_PRIORITY: {
            groundUnitPriority: [['MECH:Galvanized'], ['INFANTRY']],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 4 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 2 })

    expect(t.attacker.units.MECH).toBeUndefined()
    const infantry = t.attacker.units.INFANTRY ?? []
    expect(infantry).toHaveLength(2)
    const galvanized = infantry.filter(u => u.subtypes?.includes('Galvanized'))
    expect(galvanized).toHaveLength(2)
  })

  it('does not re-galvanize already-galvanized infantry', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { MECH: 1, INFANTRY: 2 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [
              ['MECH', 1],
              ['INFANTRY', 2],
            ],
            reinforcementTokens: 3,
          },
          SUSTAIN_DAMAGE: { groundPriority: [['MECH:Galvanized', true]] },
          UNIT_PRIORITY: {
            groundUnitPriority: [
              ['MECH:Galvanized'],
              ['INFANTRY:Galvanized'],
              ['INFANTRY'],
            ],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 4 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 2 })

    expect(t.attacker.units.MECH).toBeUndefined()
    const infantry = t.attacker.units.INFANTRY ?? []
    expect(infantry).toHaveLength(2)
    // Both infantry were already galvanized; no change.
    const galvanized = infantry.filter(u => u.subtypes?.includes('Galvanized'))
    expect(galvanized).toHaveLength(2)
  })

  it('fires per galvanized mech destroyed', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { MECH: 2, INFANTRY: 6 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['MECH', 2]],
            reinforcementTokens: 6,
          },
          SUSTAIN_DAMAGE: { groundPriority: [['MECH:Galvanized', true]] },
          UNIT_PRIORITY: {
            groundUnitPriority: [['MECH:Galvanized'], ['INFANTRY']],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 8 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    // 4 hits: 2 sustains + 2 assigned hits destroy both damaged mechs.
    t.advanceRound({ attacker: 4 })

    expect(t.attacker.units.MECH).toBeUndefined()
    const infantry = t.attacker.units.INFANTRY ?? []
    expect(infantry).toHaveLength(6)
    const galvanized = infantry.filter(u => u.subtypes?.includes('Galvanized'))
    expect(galvanized).toHaveLength(6)
  })

  it('does not fire when mech sustains but is not destroyed', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { MECH: 1, INFANTRY: 3 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['MECH', 1]],
            reinforcementTokens: 3,
          },
          SUSTAIN_DAMAGE: { groundPriority: [['MECH:Galvanized', true]] },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 4 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    // 1 hit → mech sustains but survives.
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.MECH).toHaveLength(1)
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
    expect(t.abilityLog('A3_VALIANCE')).toHaveLength(0)

    const infantry = t.attacker.units.INFANTRY ?? []
    const galvanized = infantry.filter(u => u.subtypes?.includes('Galvanized'))
    expect(galvanized).toHaveLength(0)
  })

  it('clamps to available reinforcement tokens', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { MECH: 1, INFANTRY: 3 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['MECH', 1]],
            reinforcementTokens: 1,
          },
          SUSTAIN_DAMAGE: { groundPriority: [['MECH:Galvanized', true]] },
          UNIT_PRIORITY: {
            groundUnitPriority: [['MECH:Galvanized'], ['INFANTRY']],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 4 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 2 })

    expect(t.attacker.units.MECH).toBeUndefined()
    const infantry = t.attacker.units.INFANTRY ?? []
    expect(infantry).toHaveLength(3)
    const galvanized = infantry.filter(u => u.subtypes?.includes('Galvanized'))
    expect(galvanized).toHaveLength(1)
    expect(t.state.attacker.abilities.PRE_GALVANIZED.reinforcementTokens).toBe(
      0,
    )
  })

  it('does not fire when reinforcement tokens are zero', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { MECH: 1, INFANTRY: 3 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['MECH', 1]],
            reinforcementTokens: 0,
          },
          SUSTAIN_DAMAGE: { groundPriority: [['MECH:Galvanized', true]] },
          UNIT_PRIORITY: {
            groundUnitPriority: [['MECH:Galvanized'], ['INFANTRY']],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 4 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 2 })

    expect(t.attacker.units.MECH).toBeUndefined()
    expect(t.abilityLog('A3_VALIANCE')).toHaveLength(0)
    const infantry = t.attacker.units.INFANTRY ?? []
    const galvanized = infantry.filter(u => u.subtypes?.includes('Galvanized'))
    expect(galvanized).toHaveLength(0)
  })
})
