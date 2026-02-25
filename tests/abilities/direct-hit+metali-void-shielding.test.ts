import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DIRECT_HIT + METALI_VOID_SHIELDING', () => {
  it('Direct Hit triggers when MVS grants sustain to a non-sustain ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { METALI_VOID_SHIELDING: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // 1 hit to defender: MVS sustains on cruiser → DH fires → destroys cruiser
    t.advanceRound({ defender: 1 })

    expect(t.abilityLog('METALI_VOID_SHIELDING')).not.toHaveLength(0)
    expect(t.abilityLog('DIRECT_HIT')).not.toHaveLength(0)
    // Cruiser destroyed by Direct Hit
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })

  it.fails(
    'Direct Hit does NOT trigger on ships with native sustain when MVS is active',
    () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: {
          faction: 'ARBOREC',
          units: { CRUISER: 3 },
          abilities: { DIRECT_HIT: { uses: 1 } },
        },
        defender: {
          faction: 'ARBOREC',
          units: { DREADNOUGHT: 1, CRUISER: 1 },
          abilities: { METALI_VOID_SHIELDING: true },
        },
      })

      t.advanceTo('SPACE_COMBAT', 'START')
      // 1 hit to defender: dreadnought sustains (native sustain), DH fires
      t.advanceRound({ defender: 1 })

      expect(t.abilityLog('DIRECT_HIT')).not.toHaveLength(0)
      // Dreadnought destroyed by DH
      expect(t.defender.units.DREADNOUGHT).toBeUndefined()
    },
  )
})
