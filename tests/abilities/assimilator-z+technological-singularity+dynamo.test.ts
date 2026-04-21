import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ASSIMILATOR_Z + TECHNOLOGICAL_SINGULARITY + DYNAMO', () => {
  it('Alastor destruction disables Nekro Dynamo but normal Dynamo continues', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, DREADNOUGHT: 1, CRUISER: 1 },
        abilities: {
          DYNAMO: { uses: 10 },
          NEKRO_FLAGSHIP_DYNAMO: { uses: 10 },
          SUSTAIN_DAMAGE: { spacePriority: ['FLAGSHIP', 'DREADNOUGHT'] },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    // Round 1: flagship sustains → Dynamo(s) repair → Direct Hit kills flagship
    // NEKRO_FLAGSHIP_DYNAMO DESTROY fires → uses: 0
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
    const nekroLogAfterR1 = t.abilityLog('NEKRO_FLAGSHIP_DYNAMO').length

    // Round 2: dreadnought sustains → normal DYNAMO repairs it
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(false)
    expect(t.abilityLog('DYNAMO')).not.toHaveLength(0)
    // Nekro Dynamo did not fire again after flagship destruction
    expect(t.abilityLog('NEKRO_FLAGSHIP_DYNAMO')).toHaveLength(nekroLogAfterR1)
  })
})
