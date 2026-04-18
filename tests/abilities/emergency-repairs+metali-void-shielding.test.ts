import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('EMERGENCY_REPAIRS + METALI_VOID_SHIELDING', () => {
  it('only repairs units whose stats have SUSTAIN_DAMAGE (MVS-damaged cruiser stays damaged)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 4 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 2 },
        abilities: {
          METALI_VOID_SHIELDING: true,
          EMERGENCY_REPAIRS: true,
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // 2 hits on defender: dread sustains 1 naturally, MVS absorbs 1 on a cruiser
    t.advanceRound({ defender: 2 })

    expect(t.abilityLog('METALI_VOID_SHIELDING')).not.toHaveLength(0)
    // Dreadnought is the only sustain-in-stats unit → condition met → repaired
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
    expect(t.abilityLog('EMERGENCY_REPAIRS')).not.toHaveLength(0)
    // Cruiser damaged by MVS (no SUSTAIN_DAMAGE in stats) is NOT repaired
    expect(t.defender.units.CRUISER!.filter(u => u.isDamaged)).toHaveLength(1)
  })
})
