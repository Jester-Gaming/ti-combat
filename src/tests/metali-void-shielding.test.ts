import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('METALI_VOID_SHIELDING', () => {
  it('lets a non-sustain ship absorb a hit', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { METALI_VOID_SHIELDING: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.defender.units.CRUISER![0].isDamaged).toBe(true)
    expect(t.abilityLog('METALI_VOID_SHIELDING')).not.toHaveLength(0)
  })

  it('does not target ships with native sustain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: { METALI_VOID_SHIELDING: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 2 })

    // Dreadnought uses native sustain, Cruiser uses Void Shielding
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.defender.units.CRUISER![0].isDamaged).toBe(true)
  })
})
