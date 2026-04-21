import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('HARROW + PROXIMA_TARGETING_VI', () => {
  it('Proxima fires at START and Harrow fires at END within one ground round', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { DREADNOUGHT: 2, INFANTRY: 2 },
        abilities: { HARROW: true },
      },
      defender: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 6 },
        abilities: {
          PROXIMA_TARGETING_VI: {
            isEnabled: true,
            resolveBombardment: true,
          },
        },
      },
    })

    // Walk through BOMBARDMENT → SCD → GROUND_COMBAT:START (Proxima fires its
    // two bombardments) → DICE_ROLL → ASSIGN_HITS and stop before END. Force
    // every roll up to now to 0 hits so the defender survives to the END step.
    t.advanceToTiming(
      'END_OF_COMBAT_ROUND',
      { attacker: 0, defender: 0 },
      'GROUND_COMBAT',
    )
    // END fires Harrow's bombardment; force 2 defender hits.
    t.advanceRound({ attacker: 0, defender: 2 })

    expect(t.abilityLog('PROXIMA_TARGETING_VI')).not.toHaveLength(0)
    expect(t.abilityLog('HARROW')).not.toHaveLength(0)
    // 6 defender infantry - 2 Harrow bombardment hits = 4 remaining
    expect(t.defender.units.INFANTRY).toHaveLength(4)
  })

  it("Proxima's hit cancellation applies to Harrow bombardment hits", () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { DREADNOUGHT: 2, INFANTRY: 1 },
        abilities: { HARROW: true },
      },
      defender: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3 },
        abilities: {
          PROXIMA_TARGETING_VI: true, // isEnabled: true, resolveBombardment: false
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: { INFANTRY: 2 },
            reinforcementTokens: 7,
          },
        },
      },
    })

    t.advanceToTiming(
      'END_OF_COMBAT_ROUND',
      { attacker: 0, defender: 0 },
      'GROUND_COMBAT',
    )
    // Harrow bombards with 2 dreadnought dice; force 2 raw hits. Proxima's
    // BEFORE_ASSIGN_HITS invoke fires under the nested BOMBARDMENT meta and
    // cancels 2 hits (one per galvanized infantry) — nothing lands.
    t.advanceRound({ attacker: 0, defender: 2 })

    expect(t.abilityLog('HARROW')).not.toHaveLength(0)
    expect(t.abilityLog('PROXIMA_TARGETING_VI')).not.toHaveLength(0)
    expect(t.defender.units.INFANTRY).toHaveLength(3)
  })

  it('Proxima cancels fewer Harrow hits than rolled when galvanized count is low', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { DREADNOUGHT: 2, INFANTRY: 1 },
        abilities: { HARROW: true },
      },
      defender: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3 },
        abilities: {
          PROXIMA_TARGETING_VI: true,
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: { INFANTRY: 1 },
            reinforcementTokens: 7,
          },
        },
      },
    })

    t.advanceToTiming(
      'END_OF_COMBAT_ROUND',
      { attacker: 0, defender: 0 },
      'GROUND_COMBAT',
    )
    // 2 raw Harrow hits − 1 cancelled = 1 hit lands on defender.
    t.advanceRound({ attacker: 0, defender: 2 })

    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })
})
