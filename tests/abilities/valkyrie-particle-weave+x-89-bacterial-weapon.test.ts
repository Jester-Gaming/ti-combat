import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('VALKYRIE_PARTICLE_WEAVE + X_89_BACTERIAL_WEAPON', () => {
  // TODO: this test fails in shuffle mode
  it('X-89 doubles ground combat hits, VPW adds 1 extra hit from opponent hits', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { INFANTRY: 3 },
        abilities: {
          VALKYRIE_PARTICLE_WEAVE: true,
          X_89_BACTERIAL_WEAPON: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 10 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    // Sardakk produces hits + X-89 doubles + VPW adds 1
    // Defender also produces hits -> VPW triggers
    t.advanceRound({ attacker: 1, defender: 2 })

    expect(t.abilityLog('X_89_BACTERIAL_WEAPON')).not.toHaveLength(0)
    expect(t.abilityLog('VALKYRIE_PARTICLE_WEAVE')).not.toHaveLength(0)
    expect(t.defender.units.INFANTRY).toHaveLength(5)
  })
})
