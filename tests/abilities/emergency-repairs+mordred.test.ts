import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('EMERGENCY_REPAIRS + MORDRED', () => {
  it('repairs a Nekro mech (Mordred) after it sustains a hit', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { MECH: 1, INFANTRY: 2 },
        abilities: { EMERGENCY_REPAIRS: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    // Mordred mech sustains 1 hit → sole sustain-in-stats unit damaged → ER repairs at end-of-round
    t.advanceRound({ attacker: 1 })
    expect(t.abilityLog('EMERGENCY_REPAIRS')).not.toHaveLength(0)
    expect(t.attacker.units.MECH![0].isDamaged).toBeFalsy()
  })
})
