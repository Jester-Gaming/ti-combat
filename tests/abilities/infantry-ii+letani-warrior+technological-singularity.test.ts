import { describe, expect, it } from 'vitest'

import type { UnitStats } from '@/types'

import { combatTest } from '../utils/combat-test'

function infantryStats(t: ReturnType<typeof combatTest>): UnitStats {
  const entry = t.state.attacker.unitStats.INFANTRY
  if (typeof entry === 'function')
    throw new Error('INFANTRY stats unexpectedly a factory')
  return entry as UnitStats
}

describe('INFANTRY_II + LETANI_WARRIOR + TECHNOLOGICAL_SINGULARITY', () => {
  it('Letani Warrior II is preserved when Singularity picks generic Infantry II', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { INFANTRY: 2 },
        abilities: {
          NEKRO_UNIT_ARBOREC_INFANTRY: true,
          TECHNOLOGICAL_SINGULARITY: {
            isEnabled: true,
            enableAbilityKey: 'NEKRO_GENERIC_UPGRADE_INFANTRY',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.advanceTo('GROUND_COMBAT')

    // Pre-combat: Letani Warrior II already applied via its PREPARE
    expect(infantryStats(t).NAME).toBe('Letani Warrior II')

    // Singularity fires when defender Infantry destroyed; the picked
    // generic Infantry II must NOT overwrite Letani Warrior II.
    t.advanceRound({ defender: 1 })
    expect(t.abilityLog('TECHNOLOGICAL_SINGULARITY')).not.toHaveLength(0)
    expect(infantryStats(t).NAME).toBe('Letani Warrior II')
  })
})
