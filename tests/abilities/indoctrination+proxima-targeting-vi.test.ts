import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('INDOCTRINATION + PROXIMA_TARGETING_VI', () => {
  it("Bastion's Proxima kills Yin's last infantry — Indoctrination does not fire", () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3 },
        abilities: {
          PROXIMA_TARGETING_VI: {
            isEnabled: true,
            resolveBombardment: true,
          },
        },
      },
      defender: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 1 },
        abilities: { INDOCTRINATION: true },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    // Proxima opponent-bomb: land 1 hit on Yin's only infantry.
    t.advanceToTiming('BEFORE_ASSIGN_HITS', { attacker: 0, defender: 1 })
    // Proxima self-bomb: keep Bastion alive.
    t.advanceToTiming('BEFORE_ASSIGN_HITS', { attacker: 0, defender: 0 })
    t.advanceRound({ attacker: 0, defender: 0 })

    expect(t.abilityLog('PROXIMA_TARGETING_VI')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(3)
    expect(t.defender.units.INFANTRY).toBeUndefined()
    expect(t.abilityLog('INDOCTRINATION')).toHaveLength(0)
  })
})
