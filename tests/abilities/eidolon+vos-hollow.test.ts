import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('EIDOLON + VOS_HOLLOW', () => {
  it('VH does not trigger when opponent has no mech ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { FLAGSHIP: 1, MECH: 1 },
        abilities: { VOS_HOLLOW: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2, MECH: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 2 })

    expect(t.attacker.units.MECH).toBeUndefined()
    expect(t.abilityLog('VOS_HOLLOW')).toHaveLength(0)
  })
})
