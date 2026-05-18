import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('BROTHER_MILOR + HARROW', () => {
  it('defender places 2 infantry when Harrow bombardment destroys ground forces', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { DREADNOUGHT: 2, INFANTRY: 1 },
        abilities: { HARROW: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
        abilities: { BROTHER_MILOR: true },
      },
    })

    t.advanceToTiming(
      'END_OF_COMBAT_ROUND',
      { attacker: 0, defender: 0 },
      'GROUND_COMBAT',
    )
    // Harrow resolves BOMBARDMENT; dreadnoughts [5,2] destroy 2 infantry
    t.advanceRound({ attacker: 0, defender: 2 })

    expect(t.abilityLog('HARROW')).not.toHaveLength(0)
    // Verify bombardment actually destroyed defender infantry (3 → 1)
    expect(t.abilityLog('BROTHER_MILOR')).not.toHaveLength(0)
    // 3 - 2 (destroyed by Harrow) + 2 (placed by Milor) = 3
    expect(t.defender.units.INFANTRY).toHaveLength(3)
  })

  it("Milor places infantry after Harrow destroys defender's last unit, and combat continues", () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { DREADNOUGHT: 1, INFANTRY: 1 },
        abilities: { HARROW: true },
      },
      defender: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 1 },
        abilities: { BROTHER_MILOR: true },
      },
    })

    // Bombardment: 0 hits — defender INF survives the pre-combat phase.
    t.advanceTo('GROUND_COMBAT', { attacker: 0, defender: 0 })
    expect(t.defender.units.INFANTRY).toHaveLength(1)

    // Ground combat round 1: both sides miss.
    t.advanceToTiming('END_OF_COMBAT_ROUND', { attacker: 0, defender: 0 })
    expect(t.attacker.units.INFANTRY).toHaveLength(1)
    expect(t.defender.units.INFANTRY).toHaveLength(1)

    // Harrow fires its bombardment at end-of-round; the lone dreadnought
    // destroys defender's only INFANTRY. Milor must replace it with 2 INF
    // so the defender is no longer wiped, and combat must continue into
    // round 2 instead of completing as an attacker win.
    t.advanceToTiming('START_OF_COMBAT_ROUND', { attacker: 0, defender: 1 })

    expect(t.abilityLog('HARROW')).not.toHaveLength(0)
    expect(t.abilityLog('BROTHER_MILOR')).not.toHaveLength(0)
    expect(t.defender.units.INFANTRY).toHaveLength(2)
    expect(t.isFinished()).toBe(false)
    expect(t.state.winnerSide).toBeUndefined()
  })
})
