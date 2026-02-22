import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('BROTHER_MILOR + DEVOTION', () => {
  it('places fighters when Devotion destroys own cruiser', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { CRUISER: 2, DESTROYER: 1 },
        abilities: { DEVOTION: true, BROTHER_MILOR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Devotion fires at END_OF_COMBAT_ROUND, destroys own destroyer
    // This triggers AFTER_DESTROY, Brother Milor places 2 fighters for attacker
    t.advanceRound()

    expect(t.attacker.units.DESTROYER).toBeUndefined() // Sacrificed
    expect(t.attacker.units.FIGHTER).toHaveLength(2) // Placed by Brother Milor
    expect(t.abilityLog('DEVOTION').length).toBeGreaterThan(0)
    expect(t.abilityLog('BROTHER_MILOR').length).toBeGreaterThan(0)
  })
})
