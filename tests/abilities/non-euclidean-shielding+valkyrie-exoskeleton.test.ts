import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('NON_EUCLIDEAN_SHIELDING + VALKYRIE_EXOSKELETON', () => {
  it('Sardakk attacker: NES cancels VE extra hit, 1 Letnev mech damaged', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { MECH: 2 },
      },
      defender: {
        faction: 'BARONY_OF_LETNEV',
        units: { MECH: 2 },
        abilities: { NON_EUCLIDEAN_SHIELDING: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    // Both sides produce 1 hit
    t.advanceRound({ attacker: 1, defender: 1 })

    // Sardakk (attacker) assigns 1 hit first: mech sustains → VE fires → +1 hit on Letnev
    // Letnev (defender) assigns 1+1=2 hits: mech sustains → NES cancels 1 → 0 remaining
    // Result: only 1 Letnev mech damaged

    expect(t.abilityLog('VALKYRIE_EXOSKELETON')).toHaveLength(1)
    expect(t.abilityLog('NON_EUCLIDEAN_SHIELDING')).toHaveLength(1)

    expect(t.defender.units.MECH).toHaveLength(2)
    expect(t.defender.units.MECH!.filter(u => u.isDamaged)).toHaveLength(1)

    expect(t.attacker.units.MECH).toHaveLength(2)
    expect(t.attacker.units.MECH!.filter(u => u.isDamaged)).toHaveLength(1)
  })

  it('Letnev attacker: VE extra hit arrives after NES, 2 Letnev mechs damaged', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { MECH: 2 },
        abilities: { NON_EUCLIDEAN_SHIELDING: true },
      },
      defender: {
        faction: 'SARDAKK_NORR',
        units: { MECH: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    // Both sides produce 1 hit
    t.advanceRound({ attacker: 1, defender: 1 })

    // Letnev (attacker) assigns 1 hit first: mech sustains → NES fires → nothing extra to cancel
    // Sardakk (defender) assigns 1 hit: mech sustains → VE fires → +1 hit on Letnev
    // Letnev assigns VE hit: 2nd mech sustains → NES fires → nothing extra to cancel
    // Result: 2 Letnev mechs damaged

    expect(t.abilityLog('VALKYRIE_EXOSKELETON')).toHaveLength(1)

    expect(t.attacker.units.MECH).toHaveLength(2)
    expect(t.attacker.units.MECH!.filter(u => u.isDamaged)).toHaveLength(2)

    expect(t.defender.units.MECH).toHaveLength(2)
    expect(t.defender.units.MECH!.filter(u => u.isDamaged)).toHaveLength(1)
  })
})
