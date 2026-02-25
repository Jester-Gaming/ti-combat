import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('EVELYN_DELOUIS + INDOCTRINATION', () => {
  it.fails('Evelyn fires after Indoctrination removes an infantry', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 2 },
        abilities: { INDOCTRINATION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
        abilities: {
          EVELYN_DELOUIS: { isEnabled: true, uses: 1, unitType: 'INFANTRY' },
        },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()

    expect(t.abilityLog('INDOCTRINATION')).not.toHaveLength(0)
    expect(t.abilityLog('EVELYN_DELOUIS')).not.toHaveLength(0)

    // Defender: 3 - 1 (indoctrination) = 2 infantry
    expect(t.defender.units.INFANTRY).toHaveLength(2)

    // One defender infantry gets extra die from Evelyn: [8, 2]
    const pool = t.dicePool()
    expect(pool.defender).toContainDice('INFANTRY', [8, 2])
  })

  it('Evelyn does not fire if Indoctrination removes last infantry of targeted type', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 2 },
        abilities: { INDOCTRINATION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1, MECH: 1 },
        abilities: {
          EVELYN_DELOUIS: { isEnabled: true, uses: 1, unitType: 'INFANTRY' },
        },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()

    expect(t.abilityLog('INDOCTRINATION')).not.toHaveLength(0)

    // Defender infantry removed by indoctrination
    expect(t.defender.units.INFANTRY).toBeUndefined()
    // Mech still present
    expect(t.defender.units.MECH).toHaveLength(1)
  })
})
