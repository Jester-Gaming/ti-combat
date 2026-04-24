import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('SSRUU + TELLURIAN', () => {
  it('both fire at the same BEFORE_ASSIGN_HITS (2 hits cancelled in one round)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YSSARIL_TRIBES',
        units: { CRUISER: 2 },
        abilities: {
          TELLURIAN: { isEnabled: true, uses: 1 },
          SSRUU: { isEnabled: true, agentKey: 'TELLURIAN' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 2 })

    expect(t.attacker.units.CRUISER).toHaveLength(2)
    expect(t.abilityLog('TELLURIAN')).not.toHaveLength(0)
    expect(t.abilityLog('SSRUU')).not.toHaveLength(0)
    expect(t.state.attacker.abilities.TELLURIAN.uses).toBe(0)
    expect(t.state.attacker.abilities.SSRUU.uses).toBe(0)
  })

  it('Ssruu copy does not double-fire if already used', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YSSARIL_TRIBES',
        units: { CRUISER: 3 },
        abilities: {
          TELLURIAN: { isEnabled: true, uses: 1 },
          SSRUU: { isEnabled: true, agentKey: 'TELLURIAN' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Round 1: both fire → 2 of 2 hits cancelled
    t.advanceRound({ attacker: 2 })
    expect(t.attacker.units.CRUISER).toHaveLength(3)

    // Round 2: neither fires (both exhausted) → 2 hits land
    t.advanceRound({ attacker: 2 })
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })
})
