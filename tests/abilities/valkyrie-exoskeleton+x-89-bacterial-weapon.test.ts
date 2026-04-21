import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('VALKYRIE_EXOSKELETON + X_89_BACTERIAL_WEAPON', () => {
  it('X-89 does not double Exoskeleton hit', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { MECH: 1, INFANTRY: 2 },
        abilities: { X_89_BACTERIAL_WEAPON: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 6 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    // 1 raw hit on each side
    // X-89 doubles defender hits at AFTER_DICE_ROLL: 1 → 2
    // Mech sustains attacker's hit → Exoskeleton adds 1 at AFTER_SUSTAIN_DAMAGE_USE
    // Total defender losses: 2 (X-89) + 1 (Exoskeleton) = 3
    t.advanceRound({ attacker: 1, defender: 1 })

    expect(t.abilityLog('X_89_BACTERIAL_WEAPON')).not.toHaveLength(0)
    expect(t.abilityLog('VALKYRIE_EXOSKELETON')).not.toHaveLength(0)
    expect(t.defender.units.INFANTRY).toHaveLength(3)
  })
})
