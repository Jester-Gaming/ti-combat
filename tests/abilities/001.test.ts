import { describe, expect, it } from 'vitest'

import { CombatSideState } from '@/combat'

import { combatTest } from '../utils/combat-test'

describe('0_0_1', () => {
  it('hits routed to non-fighter pool destroy cruiser, not fighter', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { FLAGSHIP: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, FIGHTER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    expect(t.abilityLog('0_0_1')).not.toHaveLength(0)
    // Cruiser dies (non-fighter pool); fighter survives.
    expect(t.defender.units.CRUISER ?? []).toHaveLength(0)
    expect(t.defender.units.FIGHTER ?? []).toHaveLength(1)
  })

  it('flagship + dread hits go to non-fighter pool; cruiser hit unrestricted', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { FLAGSHIP: 1, DREADNOUGHT: 2, CRUISER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2, FIGHTER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Pick the branch where attacker produces 3 hits.
    t.advanceRound({ defender: 3 })

    expect(t.abilityLog('0_0_1')).not.toHaveLength(0)

    // After resolving: flagship + 2 dreads hits (up to 2) target non-fighter
    // ships (2 cruisers destroyed). Remaining 1 unrestricted hit can land on
    // any unit. Since priority puts fighters at the tail, the unrestricted
    // hit consumes 1 fighter. Result: 0 cruisers, 2 fighters left.
    const cruisers = t.defender.units.CRUISER ?? []
    const fighters = t.defender.units.FIGHTER ?? []
    expect(cruisers.length + fighters.length).toBe(2)
    expect(cruisers).toHaveLength(0)
  })

  it('only fighters remain — restricted pool falls back to fighter', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { FLAGSHIP: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { FIGHTER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    expect(t.abilityLog('0_0_1')).not.toHaveLength(0)
    // TI4 "if able" semantics: no non-fighter targets exist, so the
    // restricted pool's hit falls back to a fighter rather than being
    // wasted. 1 fighter dies, 2 survive.
    expect(t.defender.units.FIGHTER ?? []).toHaveLength(2)
  })

  it('flagship destroyed in round 1 — [0.0.1] no longer fires in round 2', () => {
    // Round 1: defender lands 1 hit → flagship sustains.
    // Round 2: defender lands 1 hit → flagship destroyed.
    // Round 3: with the flagship gone, [0.0.1] must not produce a
    // restricted pool.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { FLAGSHIP: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1, defender: 0 })
    t.advanceRound({ attacker: 1, defender: 0 })

    // Flagship should be destroyed by round 2.
    expect(t.attacker.units.FLAGSHIP ?? []).toHaveLength(0)

    // [0.0.1] fired in rounds 1 and 2 (its source unit was alive at
    // AFTER_DICE_ROLL). Now advance another round with the flagship gone
    // — the ability should not fire again.
    const before = t.abilityLog('0_0_1').length
    t.advanceRound({ attacker: 0, defender: 0 })
    const after = t.abilityLog('0_0_1').length
    expect(after).toBe(before)
  })

  it('liftHitPoolRestriction merges the tagged custom entry into main.base', () => {
    // Direct API-level test for Fix 3: when the flagship is destroyed
    // mid-combat, the SideApi exposed via WHEN_DESTROY merges the
    // ability's custom entry into the main pool. Normal combat flow
    // consumes pools within a single ASSIGN_HITS step before WHEN_DESTROY
    // fires, so we exercise the API at unit level.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { FLAGSHIP: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, FIGHTER: 1 },
      },
    })
    t.advanceTo('SPACE_COMBAT')

    // Stage a pool on defender with two custom entries (the tagged 001
    // entry and one from a different ability) plus some main base hits.
    const defenderData = t.state.defender
    defenderData.hitPool = {
      base: 1,
      additional: 0,
      custom: [
        { key: '0_0_1', base: 1, unitPriority: ['CRUISER'] as never },
        { key: 'OTHER', base: 1, unitPriority: ['CRUISER'] as never },
      ],
    }
    defenderData._hitPoolShared = false

    // Lift via the same helper the WHEN_DESTROY invoke uses.
    CombatSideState.liftHitPoolRestriction(defenderData, '0_0_1')

    // Tagged entry merged into main.base; other custom entry untouched.
    expect(defenderData.hitPool!.base).toBe(2)
    expect(defenderData.hitPool!.custom).toEqual([
      { key: 'OTHER', base: 1, unitPriority: ['CRUISER'] },
    ])
  })
})
