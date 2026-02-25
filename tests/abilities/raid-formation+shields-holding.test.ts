import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('RAID_FORMATION + SHIELDS_HOLDING', () => {
  it('RF fires before SH — excess damages DN despite SH cancel', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { DESTROYER: 3 },
        abilities: { RAID_FORMATION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { FIGHTER: 1, DREADNOUGHT: 1 },
        abilities: { SHIELDS_HOLDING: { uses: 1 } },
      },
    })

    // 3 AFB hits. RF fires first (AFTER_UNIT_ABILITY_ROLL), then SH (BEFORE_ASSIGN_HITS).
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL', { defender: 3 })

    expect(t.abilityLog('RAID_FORMATION')).not.toHaveLength(0)
    expect(t.abilityLog('SHIELDS_HOLDING')).not.toHaveLength(0)
    // Fighter killed by remaining 1 AFB hit
    expect(t.defender.units.FIGHTER).toBeUndefined()
    // DN damaged by RF excess (RF fires before SH can cancel)
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })
})
