import { describe, expect, it } from 'vitest'

import { CombatState } from '../combat-state/combat-state'
import type { CombatStateData } from '../combat-state/types'
import { AbilitiesParams } from './abilities-params'
import type { Ability, AbilityCallContext, OwnOpponentContext } from './types'

describe('collectUnitAbilities', () => {
  it('should collect abilities from units on the field', () => {
    const mockAbility: Ability = {
      key: 'TEST_UNIT_ABILITY',
      name: 'Test Unit Ability',
      category: 'FACTION',
      invoke: [],
    }

    const state: CombatStateData = {
      attacker: {
        faction: 'SARDAKK_NORR',
        units: {
          FLAGSHIP: [
            { COMBAT: [6, 2], ABILITIES: [mockAbility] },
            { COMBAT: [6, 2], ABILITIES: [mockAbility] },
          ],
        },
        hitPools: [],
      },
      defender: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        hitPools: [],
      },
      abilities: {
        attacker: {},
        defender: {},
      },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    const result = AbilitiesParams.collectUnitAbilities(state, 'attacker')

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      ability: mockAbility,
      unitType: 'FLAGSHIP',
      unitIndex: 0,
    })
    expect(result[1]).toMatchObject({
      ability: mockAbility,
      unitType: 'FLAGSHIP',
      unitIndex: 1,
    })
  })

  it('should return empty array when no units have abilities', () => {
    const state: CombatStateData = {
      attacker: {
        faction: 'SARDAKK_NORR',
        units: {
          CRUISER: [{ COMBAT: [7, 1] }],
        },
        hitPools: [],
      },
      defender: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        hitPools: [],
      },
      abilities: {
        attacker: {},
        defender: {},
      },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    const result = AbilitiesParams.collectUnitAbilities(state, 'attacker')

    expect(result).toHaveLength(0)
  })

  it('should handle units with multiple abilities', () => {
    const ability1: Ability = {
      key: 'ABILITY_1',
      name: 'Ability 1',
      category: 'FACTION',
      invoke: [],
    }
    const ability2: Ability = {
      key: 'ABILITY_2',
      name: 'Ability 2',
      category: 'FACTION',
      invoke: [],
    }

    const state: CombatStateData = {
      attacker: {
        faction: 'SARDAKK_NORR',
        units: {
          FLAGSHIP: [{ COMBAT: [6, 2], ABILITIES: [ability1, ability2] }],
        },
        hitPools: [],
      },
      defender: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        hitPools: [],
      },
      abilities: {
        attacker: {},
        defender: {},
      },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    const result = AbilitiesParams.collectUnitAbilities(state, 'attacker')

    expect(result).toHaveLength(2)
    expect(result[0].ability).toBe(ability1)
    expect(result[1].ability).toBe(ability2)
  })
})

describe('unit ability invocation', () => {
  it('should invoke unit ability once per unit', () => {
    const invokeCalls: string[] = []
    const mockAbility: Ability = {
      key: 'TEST_UNIT_ABILITY',
      name: 'Test',
      category: 'FACTION',
      invoke: [
        {
          timing: 'START_OF_COMBAT_ROUND',
          call: () => {
            invokeCalls.push('called')
          },
        },
      ],
    }

    const state: CombatStateData = {
      attacker: {
        faction: 'SARDAKK_NORR',
        units: {
          FLAGSHIP: [
            { COMBAT: [6, 2], ABILITIES: [mockAbility] },
            { COMBAT: [6, 2], ABILITIES: [mockAbility] },
          ],
        },
        hitPools: [],
      },
      defender: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        hitPools: [],
      },
      abilities: {
        attacker: {},
        defender: {},
      },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    CombatState.fromData(state).params.runAbilities(
      'START_OF_COMBAT_ROUND',
      state,
    )

    expect(invokeCalls).toHaveLength(2)
  })

  it('should not invoke unit ability if unit destroyed', () => {
    const invokeCalls: number[] = []
    const mockAbility: Ability = {
      key: 'TEST_UNIT_ABILITY',
      name: 'Test',
      category: 'FACTION',
      invoke: [
        {
          timing: 'START_OF_COMBAT_ROUND',
          call: ctx => {
            invokeCalls.push(1)
            // Destroy all units via Immer draft
            ctx.state.attacker.units = {}
          },
        },
      ],
    }

    const state: CombatStateData = {
      attacker: {
        faction: 'SARDAKK_NORR',
        units: {
          FLAGSHIP: [
            { COMBAT: [6, 2], ABILITIES: [mockAbility] },
            { COMBAT: [6, 2], ABILITIES: [mockAbility] },
          ],
        },
        hitPools: [],
      },
      defender: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        hitPools: [],
      },
      abilities: {
        attacker: {},
        defender: {},
      },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    CombatState.fromData(state).params.runAbilities(
      'START_OF_COMBAT_ROUND',
      state,
    )

    // Only first unit should invoke (second destroyed by first)
    expect(invokeCalls).toHaveLength(1)
  })
})

describe('AFTER_DESTROY triggered by destroyUnit', () => {
  it('should trigger AFTER_DESTROY when an ability destroys units', () => {
    const afterDestroyCalls: { own: unknown[]; opponent: unknown[] }[] = []

    const destroyAbility: Ability = {
      key: 'DESTROY_ABILITY',
      name: 'Destroy',
      category: 'GENERAL',
      invoke: [
        {
          timing: 'START_OF_COMBAT_ROUND',
          call: (ctx: AbilityCallContext) => {
            ctx.api.opponent.destroyUnit('FIGHTER')
          },
        },
      ],
    }

    const afterDestroyAbility: Ability = {
      key: 'AFTER_DESTROY_HANDLER',
      name: 'After Destroy',
      category: 'GENERAL',
      invoke: [
        {
          timing: 'AFTER_DESTROY',
          call: (
            _ctx: AbilityCallContext,
            _params: Record<string, never>,
            context: OwnOpponentContext<unknown[]>,
          ) => {
            afterDestroyCalls.push({
              own: context.own,
              opponent: context.opponent,
            })
          },
        },
      ],
    }

    const state: CombatStateData = {
      attacker: {
        faction: 'SARDAKK_NORR',
        units: {
          CRUISER: [
            {
              COMBAT: [7, 1],
              ABILITIES: [destroyAbility],
            },
          ],
        },
        hitPools: [],
      },
      defender: {
        faction: 'FEDERATION_OF_SOL',
        units: {
          // AFTER_DESTROY on the unit that gets destroyed
          FIGHTER: [{ COMBAT: [9, 1], ABILITIES: [afterDestroyAbility] }],
        },
        hitPools: [],
      },
      abilities: {
        attacker: {},
        defender: {},
      },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    const result = CombatState.fromData(state).params.runAbilities(
      'START_OF_COMBAT_ROUND',
      state,
    )

    // Fighter should be destroyed
    expect(result.state.defender.units.FIGHTER).toBeUndefined()
    // AFTER_DESTROY should have been called (from the destroyed fighter's ability)
    expect(afterDestroyCalls).toHaveLength(1)
    // Fighter was destroyed (from fighter's perspective: own side lost it)
    expect(afterDestroyCalls[0].own).toHaveLength(1)
    expect(afterDestroyCalls[0].own[0]).toMatchObject({ type: 'FIGHTER' })
  })

  it('should NOT trigger AFTER_DESTROY when no units are destroyed', () => {
    const afterDestroyCalls: unknown[] = []

    const noopAbility: Ability = {
      key: 'NOOP_ABILITY',
      name: 'Noop',
      category: 'GENERAL',
      invoke: [
        {
          timing: 'START_OF_COMBAT_ROUND',
          call: () => {
            // Does nothing - no units destroyed
          },
        },
      ],
    }

    const afterDestroyAbility: Ability = {
      key: 'AFTER_DESTROY_HANDLER',
      name: 'After Destroy',
      category: 'GENERAL',
      invoke: [
        {
          timing: 'AFTER_DESTROY',
          call: () => {
            afterDestroyCalls.push('called')
          },
        },
      ],
    }

    const state: CombatStateData = {
      attacker: {
        faction: 'SARDAKK_NORR',
        units: {
          CRUISER: [
            {
              COMBAT: [7, 1],
              ABILITIES: [noopAbility, afterDestroyAbility],
            },
          ],
        },
        hitPools: [],
      },
      defender: {
        faction: 'FEDERATION_OF_SOL',
        units: {
          FIGHTER: [{ COMBAT: [9, 1] }],
        },
        hitPools: [],
      },
      abilities: {
        attacker: {},
        defender: {},
      },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    CombatState.fromData(state).params.runAbilities(
      'START_OF_COMBAT_ROUND',
      state,
    )

    expect(afterDestroyCalls).toHaveLength(0)
  })

  it('should NOT recursively trigger AFTER_DESTROY from AFTER_DESTROY handlers', () => {
    const afterDestroyCalls: unknown[] = []

    const destroyAbility: Ability = {
      key: 'DESTROY_ABILITY',
      name: 'Destroy',
      category: 'GENERAL',
      invoke: [
        {
          timing: 'START_OF_COMBAT_ROUND',
          call: (ctx: AbilityCallContext) => {
            ctx.api.opponent.destroyUnit('FIGHTER')
          },
        },
      ],
    }

    // This AFTER_DESTROY handler also destroys a unit — should NOT trigger another AFTER_DESTROY
    const afterDestroyAbility: Ability = {
      key: 'CHAIN_DESTROY',
      name: 'Chain Destroy',
      category: 'GENERAL',
      invoke: [
        {
          timing: 'AFTER_DESTROY',
          call: (ctx: AbilityCallContext) => {
            afterDestroyCalls.push('called')
            // From defender's FIGHTER perspective, own = defender side
            ctx.api.own.destroyUnit('CRUISER')
          },
        },
      ],
    }

    const state: CombatStateData = {
      attacker: {
        faction: 'SARDAKK_NORR',
        units: {
          FLAGSHIP: [
            {
              COMBAT: [6, 2],
              ABILITIES: [destroyAbility],
            },
          ],
        },
        hitPools: [],
      },
      defender: {
        faction: 'FEDERATION_OF_SOL',
        units: {
          // AFTER_DESTROY on the unit that gets destroyed
          FIGHTER: [{ COMBAT: [9, 1], ABILITIES: [afterDestroyAbility] }],
          CRUISER: [{ COMBAT: [7, 1] }],
        },
        hitPools: [],
      },
      abilities: {
        attacker: {},
        defender: {},
      },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    const result = CombatState.fromData(state).params.runAbilities(
      'START_OF_COMBAT_ROUND',
      state,
    )

    // Both units should be destroyed
    expect(result.state.defender.units.FIGHTER).toBeUndefined()
    expect(result.state.defender.units.CRUISER).toBeUndefined()
    // AFTER_DESTROY handler should only be called once (no recursion)
    expect(afterDestroyCalls).toHaveLength(1)
  })
})

describe('multi-timing runAbilities', () => {
  it('should resolve abilities from multiple timings in a shared window', () => {
    const calls: string[] = []

    const startOfCombatAbility: Ability = {
      key: 'START_COMBAT_ABILITY',
      name: 'Start Combat',
      category: 'GENERAL',
      invoke: [
        {
          timing: 'START_OF_COMBAT',
          call: () => {
            calls.push('START_OF_COMBAT')
          },
        },
      ],
    }

    const startOfRoundAbility: Ability = {
      key: 'START_ROUND_ABILITY',
      name: 'Start Round',
      category: 'GENERAL',
      invoke: [
        {
          timing: 'START_OF_COMBAT_ROUND',
          call: () => {
            calls.push('START_OF_COMBAT_ROUND')
          },
        },
      ],
    }

    const state: CombatStateData = {
      attacker: {
        faction: 'SARDAKK_NORR',
        units: {
          CRUISER: [
            {
              COMBAT: [7, 1],
              ABILITIES: [startOfCombatAbility, startOfRoundAbility],
            },
          ],
        },
        hitPools: [],
      },
      defender: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        hitPools: [],
      },
      abilities: {
        attacker: {},
        defender: {},
      },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    CombatState.fromData(state).params.runAbilities(
      ['START_OF_COMBAT_ROUND', 'START_OF_COMBAT'],
      state,
    )

    expect(calls).toContain('START_OF_COMBAT')
    expect(calls).toContain('START_OF_COMBAT_ROUND')
    expect(calls).toHaveLength(2)
  })

  it('should work with a single timing (non-array)', () => {
    const calls: string[] = []

    const ability: Ability = {
      key: 'SINGLE_TIMING',
      name: 'Single',
      category: 'GENERAL',
      invoke: [
        {
          timing: 'START_OF_COMBAT_ROUND',
          call: () => {
            calls.push('called')
          },
        },
      ],
    }

    const state: CombatStateData = {
      attacker: {
        faction: 'SARDAKK_NORR',
        units: {
          CRUISER: [{ COMBAT: [7, 1], ABILITIES: [ability] }],
        },
        hitPools: [],
      },
      defender: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        hitPools: [],
      },
      abilities: {
        attacker: {},
        defender: {},
      },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    CombatState.fromData(state).params.runAbilities(
      'START_OF_COMBAT_ROUND',
      state,
    )

    expect(calls).toHaveLength(1)
  })
})
