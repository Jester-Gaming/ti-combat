import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('AGNLAN_OLN', () => {
  it('fires after AFB when enabled', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'UNIVERSITIES_OF_JOL_NAR',
        units: { DESTROYER: 1, FIGHTER: 1 },
        abilities: {
          AGNLAN_OLN: { isEnabled: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { DESTROYER: 1, FIGHTER: 1 } },
    })
    t.advanceTo('AFB')
    t.advanceRound()
    expect(t.abilityLog('AGNLAN_OLN')).not.toHaveLength(0)
  })

  it('does not fire in regular space combat dice (not a unit ability)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'UNIVERSITIES_OF_JOL_NAR',
        units: { CRUISER: 1 },
        abilities: {
          AGNLAN_OLN: { isEnabled: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const combatPhaseEntries = t
      .abilityLog('AGNLAN_OLN')
      .filter(e => e.path.includes('SPACE_COMBAT') && !e.path.includes('AFB'))
    expect(combatPhaseEntries).toHaveLength(0)
  })
})
