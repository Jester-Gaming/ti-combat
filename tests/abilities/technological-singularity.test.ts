import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TECHNOLOGICAL_SINGULARITY', () => {
  it('fires when opponent unit is destroyed in combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { CRUISER: 3 },
        abilities: { TECHNOLOGICAL_SINGULARITY: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    // Verify unit was actually destroyed
    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.abilityLog('TECHNOLOGICAL_SINGULARITY')).not.toHaveLength(0)
  })
})
