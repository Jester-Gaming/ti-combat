import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('SSRUU + BROTHER_MILOR', () => {
  it('both fire on a single destroyed ship — 4 fighters placed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YSSARIL_TRIBES',
        units: { CRUISER: 1, FIGHTER: 1 },
        abilities: {
          BROTHER_MILOR: true,
          SSRUU: { isEnabled: true, agentKey: 'BROTHER_MILOR' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Attacker loses 1 fighter; Milor places 2 fighters, Ssruu copy places 2 more
    t.advanceRound({ attacker: 1 })

    // 1 start - 1 destroyed + 2 (Milor) + 2 (Ssruu copy) = 4
    expect(t.attacker.units.FIGHTER).toHaveLength(4)
    expect(t.abilityLog('BROTHER_MILOR')).not.toHaveLength(0)
    expect(t.abilityLog('SSRUU')).not.toHaveLength(0)
  })
})
