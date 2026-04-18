import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('PROXIMA_TARGETING_VI', () => {
  it('resolves two bombardments: opponent first, then own', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3 },
        abilities: {
          PROXIMA_TARGETING_VI: {
            isEnabled: true,
            resolveBombardment: true,
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL', { attacker: 0, defender: 0 })

    expect(t.dicePool().hitSource).toBe('BOMBARDMENT')
    expect(t.dicePool(-2).hitSource).toBe('BOMBARDMENT')
    expect(t.abilityLog('PROXIMA_TARGETING_VI')).not.toHaveLength(0)
  })

  it('second roll hits own ground forces (hitTarget flip)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3 },
        abilities: {
          PROXIMA_TARGETING_VI: {
            isEnabled: true,
            resolveBombardment: true,
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    // First Proxima roll: 0 opponent hits. Second Proxima roll: 3 hits on
    // attacker (all 3 custom dice produce hits). Main combat: 0 hits.
    t.advanceRound({ attacker: 3, defender: 0 })

    // 3 attacker infantry - 3 killed by own-targeted Proxima roll = 0 left
    expect(t.attacker.units.INFANTRY).toBeUndefined()
    expect(t.defender.units.INFANTRY).toHaveLength(3)
  })

  it('does NOT resolve bombardment when resolveBombardment is false (default)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3 },
        abilities: { PROXIMA_TARGETING_VI: true }, // isEnabled: true, resolveBombardment: false
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound({ attacker: 0, defender: 0 })

    const proximaBombardments = t
      .abilityLog('PROXIMA_TARGETING_VI')
      .filter(entry => entry.path.includes('BOMBARDMENT'))
    expect(proximaBombardments).toHaveLength(0)
  })

  it('cancels 1 bombardment hit per galvanized unit (defender-side)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2, INFANTRY: 1 },
      },
      defender: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3 },
        abilities: {
          PROXIMA_TARGETING_VI: true,
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: { INFANTRY: 1 },
            reinforcementTokens: 7,
          },
        },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE', undefined, { attacker: 0, defender: 2 })

    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })
})
