import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('EIDOLON_MAXIMUM + VOS_HOLLOW', () => {
  it('VH does not trigger when Eidolon Maximum (mech-as-ship) is destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1 },
        abilities: {
          EIDOLON_MAXIMUM: true,
          VOS_HOLLOW: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2, MECH: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 2 })

    expect(t.attacker.units.MECH).toBeUndefined()
    expect(t.defender.units.MECH).toHaveLength(1)

    expect(t.abilityLog('VOS_HOLLOW')).toHaveLength(0)
  })
})
