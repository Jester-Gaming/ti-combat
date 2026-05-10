import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TECHNOLOGICAL_SINGULARITY + ADVANCED_CARRIER + DIRECT_HIT', () => {
  it('carrier gains sustain mid-BEFORE_ASSIGN_HITS and uses it immediately', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { CARRIER: 1, CRUISER: 2 },
        abilities: {
          DIRECT_HIT: { uses: 1 },
          TECHNOLOGICAL_SINGULARITY: {
            isEnabled: true,
            enableAbilityKey: 'NEKRO_UNIT_FEDERATION_OF_SOL_CARRIER',
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    // 1 hit on each side:
    // Defender: dreadnought sustains → Direct Hit kills it → TS enables Advanced Carrier
    // Attacker: carrier now has sustain → absorbs the hit
    t.advanceRound({ attacker: 1, defender: 1 })

    // Defender dreadnought destroyed by Direct Hit
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
    expect(t.abilityLog('TECHNOLOGICAL_SINGULARITY')).not.toHaveLength(0)

    // Carrier survived by sustaining (gained mid-timing)
    expect(t.attacker.units.CARRIER).toHaveLength(1)
    expect(t.attacker.units.CARRIER![0].isDamaged).toBe(true)
  })
})
