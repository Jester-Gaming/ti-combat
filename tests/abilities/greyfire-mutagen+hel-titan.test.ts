import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('GREYFIRE_MUTAGEN + HEL_TITAN', () => {
  it('counts Hel-Titan PDS as ground force for 2+ check', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'EMIRATES_OF_HACAN',
        units: { INFANTRY: 1 },
        abilities: { GREYFIRE_MUTAGEN: true },
      },
      defender: {
        faction: 'TITANS_OF_UL',
        units: { PDS: 1, INFANTRY: 1 },
      },
    })

    // PDS counts as ground force via Hel-Titan → 2 ground forces → Greyfire fires
    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('GREYFIRE_MUTAGEN')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
    expect(t.defender.units.INFANTRY).toBeUndefined()
  })
})
