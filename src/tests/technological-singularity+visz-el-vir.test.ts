import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe.skip('VISZ_EL_VIR + TECHNOLOGICAL_SINGULARITY', () => {
  it('no extra mech dice in round 1', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, MECH: 1 },
        abilities: {
          VISZ_EL_VIR: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Mech base: [6, 1], no Visz El Vir bonus
    expect(pool.attacker).toContainDice('MECH', [6, 1])
  })

  it('+1 mech die after kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, MECH: 1 },
        abilities: {
          VISZ_EL_VIR: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: kill 1 defender cruiser
    t.advanceRound({ defender: 1 })
    // Round 2: Visz El Vir activates
    t.advanceRound()
    const pool = t.dicePool()!

    // Mech: [6, 1] + 1(Visz El Vir) = [6, 2]
    expect(pool.attacker).toContainDice('MECH', [6, 2])
  })
})
