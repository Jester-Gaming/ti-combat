import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('BROTHER_MILOR + VAN_HAUGE', () => {
  it('Brother Milor places fighters after Van Hauge destroys all ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
      defender: {
        faction: 'YIN_BROTHERHOOD',
        units: { FLAGSHIP: 1, CRUISER: 1 },
        abilities: { BROTHER_MILOR: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Damage Van Hauge (sustain)
    t.advanceRound({ defender: 3 })

    expect(t.abilityLog('VAN_HAUGE')).not.toHaveLength(0)
    expect(t.abilityLog('BROTHER_MILOR')).not.toHaveLength(0)
    // Yin should have 2 fighters from Brother Milor
    expect(t.defender.units.FIGHTER).toHaveLength(2)
    // Attacker should have no ships (Van Hauge destroyed them)
    expect(t.attacker.units.CRUISER).toBeUndefined()
  })

  it.fails(
    'Opponent Brother Milor places fighters after Van Hauge destroys their ships',
    () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: {
          faction: 'ARBOREC',
          units: { CRUISER: 2 },
          abilities: { BROTHER_MILOR: true },
        },
        defender: {
          faction: 'YIN_BROTHERHOOD',
          units: { FLAGSHIP: 1 },
        },
      })

      t.advanceTo('SPACE_COMBAT', 'START')
      t.advanceRound({ defender: 2 })

      expect(t.abilityLog('VAN_HAUGE')).not.toHaveLength(0)
      expect(t.abilityLog('BROTHER_MILOR')).not.toHaveLength(0)
      // Attacker gets 2 fighters from BM
      expect(t.attacker.units.FIGHTER).toHaveLength(2)
    },
  )
})
