import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('DUNLAIN_REAPER + ENTROPIC_SCAR', () => {
  it('Entropic Scar disables deploy', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 3 },
        abilities: {
          DUNLAIN_REAPER: { uses: 1 },
          ENTROPIC_SCAR: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { ENTROPIC_SCAR: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound(0)

    // DEPLOY is a unit ability on MECH, so Entropic Scar disables it
    expect(t.abilityLog('DUNLAIN_REAPER')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(3)
    expect(t.attacker.units.MECH).toBeUndefined()
  })
})
