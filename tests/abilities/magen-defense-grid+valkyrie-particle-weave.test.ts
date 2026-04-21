import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('MAGEN_DEFENSE_GRID + VALKYRIE_PARTICLE_WEAVE', () => {
  it('VPW does not fire when dice produce 0 hits despite MDG hit', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { INFANTRY: 3 },
        abilities: { VALKYRIE_PARTICLE_WEAVE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2, PDS: 1 },
        abilities: { MAGEN_DEFENSE_GRID: true },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    // 0 total hits from dice — no hits on Sardakk from dice roll
    t.advanceRound(0)

    // MDG should still fire (it's at START_OF_COMBAT, independent of dice)
    expect(t.abilityLog('MAGEN_DEFENSE_GRID')).not.toHaveLength(0)
    // VPW should NOT fire — VPW checks dice roll hits, not MDG hits
    expect(t.abilityLog('VALKYRIE_PARTICLE_WEAVE')).toHaveLength(0)
  })
})
