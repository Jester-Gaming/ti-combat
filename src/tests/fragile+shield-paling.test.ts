import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('FRAGILE + SHIELD_PALING', () => {
  it('prevents Fragile from affecting infantry dice', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'UNIVERSITIES_OF_JOL_NAR',
        units: { MECH: 1, INFANTRY: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Infantry: 8 (base), Fragile excluded by Shield Paling
    expect(pool.attacker).toContainDice('INFANTRY', [8, 1])
    // Mech: 6 + 1(Fragile) = 7, still affected
    expect(pool.attacker).toContainDice('MECH', [7, 1])
  })

  it('restores Fragile to infantry when last mech is destroyed', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'UNIVERSITIES_OF_JOL_NAR',
        units: { MECH: 1, INFANTRY: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    // Mech sustains
    t.advanceRound({ attacker: 1 })
    // Infantry dies (sacrifice order), then damaged mech dies
    t.advanceRound({ attacker: 2 })

    expect(t.attacker.units.MECH).toBeUndefined()
    expect(t.attacker.units.INFANTRY).toBeUndefined()

    // AFTER_DESTROY fired (PREPARE doesn't log)
    expect(t.abilityLog('SHIELD_PALING')).not.toHaveLength(0)
  })

  it('does not restore Fragile while at least one mech remains', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'UNIVERSITIES_OF_JOL_NAR',
        units: { MECH: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    // Both mechs sustain
    t.advanceRound({ attacker: 2 })
    // One damaged mech dies
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.MECH).toHaveLength(1)

    // AFTER_DESTROY blocked (1 mech remains), PREPARE doesn't log
    expect(t.abilityLog('SHIELD_PALING')).toHaveLength(0)
  })
})
