import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('PROXIMA_TARGETING_VI + X_89_BACTERIAL_WEAPON', () => {
  it('X-89 doubles hits from both Proxima rolls (opponent-target and self-target)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 6 },
        abilities: {
          PROXIMA_TARGETING_VI: {
            isEnabled: true,
            resolveBombardment: true,
          },
          X_89_BACTERIAL_WEAPON: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 6 },
      },
    })

    // Narrow verification: force R2 (self-target) to 1 raw hit. X-89 doubles
    // → 2 attacker infantry lost.
    t.advanceTo('GROUND_COMBAT')
    t.advanceToTiming('BEFORE_ASSIGN_HITS', { attacker: 0, defender: 1 })
    t.advanceToTiming('BEFORE_ASSIGN_HITS', { attacker: 1, defender: 0 })
    t.advanceRound()

    expect(t.abilityLog('X_89_BACTERIAL_WEAPON')).not.toHaveLength(0)
    expect(t.defender.units.INFANTRY).toHaveLength(4)
    expect(t.attacker.units.INFANTRY).toHaveLength(4)
  })

  it("opponent's X-89 does NOT fire for Proxima bombardment", () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 6 },
        abilities: {
          PROXIMA_TARGETING_VI: {
            isEnabled: true,
            resolveBombardment: true,
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 6 },
        abilities: { X_89_BACTERIAL_WEAPON: true },
      },
    })
    t.advanceToTiming('BEFORE_ASSIGN_HITS', { attacker: 0, defender: 1 })
    t.advanceToTiming('BEFORE_ASSIGN_HITS', { attacker: 1, defender: 0 })
    t.advanceRound()

    // Defender's X-89 must not fire for attacker-owned Proxima rolls.
    expect(t.abilityLog('X_89_BACTERIAL_WEAPON')).toHaveLength(0)
    // No doubling: self-target produced 1 raw hit → 1 attacker infantry lost.
    expect(t.defender.units.INFANTRY).toHaveLength(5)
    expect(t.attacker.units.INFANTRY).toHaveLength(5)
  })
})
