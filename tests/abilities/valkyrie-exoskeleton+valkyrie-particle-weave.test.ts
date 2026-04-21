import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('VALKYRIE_EXOSKELETON + VALKYRIE_PARTICLE_WEAVE', () => {
  it('both produce extra hits in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: { VALKYRIE_PARTICLE_WEAVE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 4 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    // 1 hit to attacker: mech sustains -> VE produces 1 hit
    // Defender produced >= 1 hit -> VPW produces 1 additional hit
    t.advanceRound({ attacker: 1 })

    // VE fired (mech sustained)
    expect(t.abilityLog('VALKYRIE_EXOSKELETON')).not.toHaveLength(0)
    // VPW fired (opponent produced hits)
    expect(t.abilityLog('VALKYRIE_PARTICLE_WEAVE')).not.toHaveLength(0)

    // Mech sustained
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
  })

  it('VPW fires even if VE does not (no sustain needed)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { INFANTRY: 2 },
        abilities: { VALKYRIE_PARTICLE_WEAVE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    // Defender produces >= 1 hit -> VPW fires
    t.advanceRound({ attacker: 1 })

    expect(t.abilityLog('VALKYRIE_PARTICLE_WEAVE')).not.toHaveLength(0)
    // No mech, no VE
    expect(t.abilityLog('VALKYRIE_EXOSKELETON')).toHaveLength(0)
  })
})
