import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('A3_VALIANCE + EVELYN_DELOUIS', () => {
  it('galvanizes the Evelyn-targeted infantry, leaving Galvanized after cleanup', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['MECH', 1]],
            reinforcementTokens: 3,
          },
          EVELYN_DELOUIS: { isEnabled: true, unitType: 'INFANTRY' },
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
    expect(infantry).toHaveLength(1)
    expect(infantry[0].subtypes).include('Galvanized')
    t.advanceRound()
    expect(infantry[0].subtypes).toEqual(['Galvanized'])
  })
})
