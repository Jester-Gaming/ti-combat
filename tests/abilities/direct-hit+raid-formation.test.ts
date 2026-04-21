import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

// Raid Formation damages ships directly (modifyUnitState isDamaged),
// bypassing the Sustain Damage ability flow. DH (AFTER_SUSTAIN_DAMAGE_USE)
// should NOT trigger from RF damage.
describe('DIRECT_HIT + RAID_FORMATION', () => {
  it('DH does NOT fire on ships damaged by Raid Formation', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { DESTROYER: 3 },
        abilities: { DIRECT_HIT: { uses: 2 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { FIGHTER: 1, DREADNOUGHT: 1 },
      },
    })

    // 3 destroyers AFB 9x2 = 6 dice; pick 3 hits: 3 - 1 fighter = 2 excess
    // RF damages the dreadnought directly (not via sustain)
    t.advanceToTiming('BEFORE_ASSIGN_HITS', 3, 'AFB')

    expect(t.abilityLog('RAID_FORMATION')).not.toHaveLength(0)
    // DH should NOT have fired (RF damage is not sustain usage)
    expect(t.abilityLog('DIRECT_HIT')).toHaveLength(0)
    // Dreadnought damaged by RF but not destroyed
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })
})
