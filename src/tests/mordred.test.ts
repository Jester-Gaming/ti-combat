import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('MORDRED', () => {
  it('+2 applies by default', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { MECH: 1 },
        abilities: { MORDRED: true },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Mech base: [6, 1], Mordred -2 → [4, 1]
    expect(pool.attacker).toContainDice('MECH', [4, 1])
  })

  it('checkbox on: no bonus without destroy', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { MECH: 1 },
        abilities: {
          MORDRED: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // No bonus yet — base [6, 1]
    expect(pool.attacker).toContainDice('MECH', [6, 1])
  })

  it('checkbox on: +2 activates after opponent destroyed in combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { MECH: 1 },
        abilities: {
          MORDRED: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    // Round 1: defender loses 1 infantry
    t.advanceRound({ defender: 1 })
    // Round 2: bonus should now be active
    t.advanceRound()
    const pool = t.dicePool()!

    // Mordred -2 now active → [4, 1]
    expect(pool.attacker).toContainDice('MECH', [4, 1])
  })

  it('SCO destroy does NOT trigger the checkbox', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, MECH: 1, PDS: 1 },
        abilities: {
          MORDRED: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, FIGHTER: 1 },
      },
    })

    // SCO from attacker PDS destroys defender FIGHTER
    t.advanceTo('AFB', undefined, { defender: 1 })
    expect(t.defender.units.FIGHTER).toBeUndefined()

    // Space combat round 1: Mordred +2 should NOT be active
    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // No bonus — base [6, 1]
    expect(pool.attacker).toContainDice('MECH', [6, 1])
  })
})
