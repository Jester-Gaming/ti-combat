import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ASSIMILATOR_Z + TECHNOLOGICAL_SINGULARITY + ARC_SECUNDUS', () => {
  it('gained via AC in round 1 — repairs flagship in same round', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, CRUISER: 2 },
        abilities: {
          ASSAULT_CANNON: true,
          PRE_DAMAGED: { isEnabled: true, damagedUnits: [['FLAGSHIP', 1]] },
          TECHNOLOGICAL_SINGULARITY: {
            isEnabled: true,
            enableAbilityKey: 'NEKRO_FLAGSHIP_ARC_SECUNDUS',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    // Verify flagship starts damaged
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)

    // START_OF_COMBAT: AC kills → TS enables Arc Secundus
    // START_OF_COMBAT_ROUND: Arc Secundus repairs flagship
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.defender.units.CRUISER).toHaveLength(2) // 3 - 1 from AC
    expect(t.abilityLog('TECHNOLOGICAL_SINGULARITY')).not.toHaveLength(0)

    // Flagship repaired in round 1
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBeFalsy()
  })

  it('gained via combat kill — repairs flagship in round 2', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, CRUISER: 2 },
        abilities: {
          PRE_DAMAGED: { isEnabled: true, damagedUnits: [['FLAGSHIP', 1]] },
          TECHNOLOGICAL_SINGULARITY: {
            isEnabled: true,
            enableAbilityKey: 'NEKRO_FLAGSHIP_ARC_SECUNDUS',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)

    t.advanceTo('SPACE_COMBAT')

    // Round 1: defender loses 1 cruiser → TS enables Arc Secundus
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.CRUISER).toHaveLength(2)
    expect(t.abilityLog('TECHNOLOGICAL_SINGULARITY')).not.toHaveLength(0)

    // Flagship still damaged after round 1 (Arc Secundus wasn't active at START_OF_COMBAT_ROUND)
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)

    // Round 2: Arc Secundus repairs at START_OF_COMBAT_ROUND
    t.advanceRound()

    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBeFalsy()
  })
})
