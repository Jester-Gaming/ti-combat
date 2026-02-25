import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ARTICLES_OF_WAR + DUNLAIN_REAPER', () => {
  it.fails("deploy shouldn't work", () => {
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

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()

    // Dunlain Reaper should still fire (it's a config ability, not a printed ability)
    expect(t.abilityLog('DUNLAIN_REAPER')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(3)
    expect(t.attacker.units.MECH).toHaveLength(0)
  })
})
