import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('NON_EUCLIDEAN_SHIELDING + X_89_BACTERIAL_WEAPON', () => {
  it('NES cancels 2 of the doubled ground combat hits with a single sustain', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
        abilities: { X_89_BACTERIAL_WEAPON: true },
      },
      defender: {
        faction: 'BARONY_OF_LETNEV',
        units: { MECH: 1 },
        abilities: { NON_EUCLIDEAN_SHIELDING: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    // Attacker produces 1 hit, X-89 doubles to 2
    // Defender mech sustains once, NES cancels 2 hits → both absorbed
    t.advanceRound({ defender: 2 })

    expect(t.abilityLog('X_89_BACTERIAL_WEAPON')).not.toHaveLength(0)
    expect(t.defender.units.MECH![0].isDamaged).toBe(true)
    expect(t.defender.units.MECH).toHaveLength(1)
  })

  it('NES cannot absorb all doubled hits when more than 2', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 4 },
        abilities: { X_89_BACTERIAL_WEAPON: true },
      },
      defender: {
        faction: 'BARONY_OF_LETNEV',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: { NON_EUCLIDEAN_SHIELDING: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    // Attacker produces 2 hits, X-89 doubles to 4
    // Defender mech sustains once, NES cancels 2 → 2 remaining hits
    // 2 hits destroy mech + infantry
    t.advanceRound({ defender: 4 })

    expect(t.abilityLog('X_89_BACTERIAL_WEAPON')).not.toHaveLength(0)
    expect(t.defender.units.MECH).toBeUndefined()
    expect(t.defender.units.INFANTRY).toBeUndefined()
  })
})
