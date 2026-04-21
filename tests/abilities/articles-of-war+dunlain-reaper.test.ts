import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ARTICLES_OF_WAR + DUNLAIN_REAPER', () => {
  it('Articles of War disables deploy', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 3 },
        abilities: {
          DUNLAIN_REAPER: { uses: 1 },
          ARTICLES_OF_WAR: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    // DEPLOY is a unit ability on MECH, so Articles of War disables it
    expect(t.abilityLog('DUNLAIN_REAPER')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(3)
    expect(t.attacker.units.MECH).toBeUndefined()
  })
})
