import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('MORDRED + THE_ALASTOR', () => {
  it('Mordred +2 applies when mech participates in space combat via Alastor', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, MECH: 1 },
        abilities: { MORDRED: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Mech base: [6, 1], Mordred -2 -> [4, 1]
    expect(pool.attacker).toContainDice('MECH', [4, 1])
  })

  it('Mordred affects only mechs, not other units', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, MECH: 1, INFANTRY: 1 },
        abilities: { MORDRED: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Mech: [6, 1] - 2 = [4, 1]
    expect(pool.attacker).toContainDice('MECH', [4, 1])
    // Flagship: [9, 2] base (no Mordred bonus)
    expect(pool.attacker).toContainDice('FLAGSHIP', [9, 2])
    // Infantry: [8, 1] base (no Mordred bonus)
    expect(pool.attacker).toContainDice('INFANTRY', [8, 1])
  })

  it('Mordred does not stack with multiple mechs', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, MECH: 2 },
        abilities: { MORDRED: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Each Mech: [6, 1] - 2 = [4, 1] (not [2, 1])
    expect(pool.attacker).toContainDice('MECH', [4, 1])
  })
})
