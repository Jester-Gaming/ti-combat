import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('GREYFIRE_MUTAGEN + MATRIARCH', () => {
  it('counts committed fighters toward ground force threshold', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        units: { FLAGSHIP: 1, FIGHTER: 1, INFANTRY: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
        abilities: {
          GREYFIRE_MUTAGEN: { isEnabled: true, uses: 1 },
        },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    // Greyfire should fire: opponent has 2 ground forces (infantry + fighter)
    expect(t.abilityLog('GREYFIRE_MUTAGEN')).not.toHaveLength(0)
    // Greyfire replaces 1 opponent infantry with own infantry
    expect(t.attacker.units.INFANTRY).toBeUndefined()
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })

  it('does not replace committed fighters (only targets infantry)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        units: { FLAGSHIP: 1, FIGHTER: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
        abilities: {
          GREYFIRE_MUTAGEN: true,
        },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    // Greyfire should not fire: opponent has no infantry to replace
    // (2 fighters count as ground forces for threshold, but no infantry target)
    expect(t.abilityLog('GREYFIRE_MUTAGEN')).toHaveLength(0)
    expect(t.attacker.units.FIGHTER).toHaveLength(2)
  })
})
