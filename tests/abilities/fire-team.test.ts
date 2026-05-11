import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('FIRE_TEAM', () => {
  it('fires once during ground combat when enabled', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: {
          FIRE_TEAM: { isEnabled: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })
    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()
    expect(t.abilityLog('FIRE_TEAM')).not.toHaveLength(0)
  })
})
