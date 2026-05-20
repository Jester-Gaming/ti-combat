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
          SUSTAIN_DAMAGE: {
            spacePriority: [
              ['FLAGSHIP', true],
              ['DREADNOUGHT', true],
            ],
          },
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
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
    expect(t.abilityLog('DYNAMO')).not.toHaveLength(0)
    // Nekro Dynamo did not fire again after flagship destruction
    expect(t.abilityLog('NEKRO_FLAGSHIP_DYNAMO')).toHaveLength(nekroLogAfterR1)
  })

  it('Nekro Dynamo and normal Dynamo do not both repair the same unit', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: {
          DYNAMO: { uses: 10 },
          NEKRO_FLAGSHIP_DYNAMO: { uses: 10 },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // 1 hit: dreadnought sustains once, then a Dynamo repairs it
    t.advanceRound({ attacker: 1 })

    // Dreadnought sustained then got repaired
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBeFalsy()

    // Only ONE repair happened — a single sustained unit shouldn't be repaired
    // twice, so exactly one use is consumed across both Dynamos (not two)
    const dynamoUses = Number(t.state.attacker.abilities.DYNAMO.uses)
    const nekroUses = Number(
      t.state.attacker.abilities.NEKRO_FLAGSHIP_DYNAMO.uses,
    )
    expect(dynamoUses + nekroUses).toBe(19)
  })
})
