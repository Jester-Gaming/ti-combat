import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('BLITZ + HARROW', () => {
  it('Harrow uses Blitz-granted cruiser dice alongside native dreadnought bombardment', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { DREADNOUGHT: 1, CRUISER: 2, INFANTRY: 1 },
        abilities: { BLITZ: true, HARROW: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 5 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'END', { attacker: 0, defender: 0 })
    t.advanceRound({ attacker: 0, defender: 3 })

    expect(t.dicePool().hitSource).toBe('BOMBARDMENT')
    expect(t.abilityLog('HARROW')).not.toHaveLength(0)
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })

  it('Harrow fires on Blitz-only dice when no native bombardment unit is present', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { CRUISER: 3, INFANTRY: 1 },
        abilities: { BLITZ: true, HARROW: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 5 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'END', { attacker: 0, defender: 0 })

    t.advanceRound({ attacker: 0, defender: 3 })
    expect(t.dicePool().hitSource).toBe('BOMBARDMENT')
    expect(t.abilityLog('HARROW')).not.toHaveLength(0)
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })
})
