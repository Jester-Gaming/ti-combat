import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('VISZ_EL_VIR', () => {
  it('mechs roll 1 additional die in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { FLAGSHIP: 1, MECH: 1 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Mech Z-Grav form: [8, 2] + 1 die from Visz El Vir = [8, 3]
    expect(pool.attacker).toContainDice('MECH', [8, 3])
  })

  it('each mech gets +1 die with multiple mechs', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { FLAGSHIP: 1, MECH: 3 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Each mech: [8, 2] + 1 = [8, 3]
    const mechDice = pool.attacker.MECH!
    expect(mechDice).toHaveLength(3)
    for (const group of mechDice) {
      expect(group[0]).toBe(8)
      expect(group[1] + group[2]).toBe(3)
    }
  })

  it('mechs roll 1 additional die in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { FLAGSHIP: 1, MECH: 1, INFANTRY: 1 },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Mech normal stats: [6, 2] + 1 die from Visz El Vir = [6, 3]
    expect(pool.attacker).toContainDice('MECH', [6, 3])
  })

  it('does not fire without flagship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Mech Z-Grav form: [8, 2] — no extra die without flagship
    expect(pool.attacker).toContainDice('MECH', [8, 2])
  })
})
