import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe.skip('DIRECT_HIT + VISZ_EL_VIR + TECHNOLOGICAL_SINGULARITY', () => {
  it('+1 mech die after direct hit kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, MECH: 1 },
        abilities: {
          DIRECT_HIT: { uses: 1 },
          VISZ_EL_VIR: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: DN sustains → DH kills it → TS triggers
    t.advanceRound({ defender: 1 })
    // Round 2: Visz El Vir activates
    t.advanceRound()
    const pool = t.dicePool()!

    // Mech: [6, 1] + 1(Visz El Vir) = [6, 2]
    expect(pool.attacker).toContainDice('MECH', [6, 2])
  })
})
