import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('DAME_BRIAR + VISCOUNT_UNLENN', () => {
  it('galvanizes the Viscount-targeted destroyer, leaving Galvanized after cleanup', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'LAST_BASTION',
        units: { DESTROYER: 1, CRUISER: 1 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            reinforcementTokens: 3,
          },
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'DESTROYER' },
          DAME_BRIAR: { isEnabled: true, spaceUnitType: 'DESTROYER:Viscount' },
          UNIT_PRIORITY: {
            spaceUnitPriority: [['CRUISER'], ['DESTROYER']],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // 1 hit destroys the cruiser (no sustain), triggering DAME_BRIAR
    // to galvanize the destroyer (which already has Viscount subtype).
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.CRUISER).toBeUndefined()
    expect(t.abilityLog('DAME_BRIAR')).not.toHaveLength(0)

    const destroyers = t.attacker.units.DESTROYER ?? []
    expect(destroyers).toHaveLength(1)
    expect(destroyers[0].subtypes).include('Galvanized')
    t.advanceRound()
    expect(destroyers[0].subtypes).toEqual(['Galvanized'])
  })
})
