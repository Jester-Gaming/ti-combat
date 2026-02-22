import { describe, expect, it } from 'vitest'

import type { UnitId, UnitStats } from '@/types'

import { CombatState } from '../combat-state/combat-state'
import type { CombatStateData, SideStateData } from '../combat-state/types'
import { nextUnitIds } from '../utils/unit-id'
import { AbilitiesEngine } from './abilities-engine'
import type { Ability, AbilityCallContext, OwnOpponentContext } from './types'

/** Helper to build compact SideStateData from unit specs */
function buildSide(
  faction: SideStateData['faction'],
  unitSpecs: Record<string, { count: number; stats: UnitStats }>,
): SideStateData {
  const units = {} as SideStateData['units']
  const unitStats = {} as SideStateData['unitStats']
  for (const [key, spec] of Object.entries(unitSpecs)) {
    const k = key as import('@/types').UnitType
    units[k] = nextUnitIds(spec.count)
    unitStats[k] = spec.stats
  }
  return { faction, units, unitState: {}, unitStats, hitPools: [] }
}

const emptySide = (
  faction: SideStateData['faction'] = 'FEDERATION_OF_SOL',
): SideStateData => ({
  faction,
  units: {} as SideStateData['units'],
  unitState: {},
  unitStats: {} as SideStateData['unitStats'],
  hitPools: [],
})

describe('collectUnitAbilities', () => {
  it('should collect abilities from units on the field', () => {
    const mockAbility: Ability = {
      key: 'TEST_UNIT_ABILITY',
      name: 'Test Unit Ability',
      category: 'FACTION',
      params: { isEnabled: true, uses: Infinity },
      invoke: [],
    }

    const state: CombatStateData = {
      attacker: buildSide('SARDAKK_NORR', {
        FLAGSHIP: {
          count: 2,
          stats: {
            COMBAT: [6, 2],
            UNIT_ABILITIES: {},
            ABILITIES: [mockAbility],
          },
        },
      }),
      defender: emptySide(),
      abilities: { attacker: {}, defender: {} },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    const result = AbilitiesEngine.collectUnitAbilities(state, 'attacker')

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      ability: mockAbility,
      unitType: 'FLAGSHIP',
    })
    expect(result[1]).toMatchObject({
      ability: mockAbility,
      unitType: 'FLAGSHIP',
    })
    // Each entry should have a unique UnitId
    expect(result[0].unitId).not.toBe(result[1].unitId)
  })

  it('should return empty array when no units have abilities', () => {
    const state: CombatStateData = {
      attacker: buildSide('SARDAKK_NORR', {
        CRUISER: { count: 1, stats: { COMBAT: [7, 1], UNIT_ABILITIES: {} } },
      }),
      defender: emptySide(),
      abilities: { attacker: {}, defender: {} },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    const result = AbilitiesEngine.collectUnitAbilities(state, 'attacker')

    expect(result).toHaveLength(0)
  })

  it('should handle units with multiple abilities', () => {
    const ability1: Ability = {
      key: 'ABILITY_1',
      name: 'Ability 1',
      category: 'FACTION',
      params: { isEnabled: true, uses: Infinity },
      invoke: [],
    }
    const ability2: Ability = {
      key: 'ABILITY_2',
      name: 'Ability 2',
      category: 'FACTION',
      params: { isEnabled: true, uses: Infinity },
      invoke: [],
    }

    const state: CombatStateData = {
      attacker: buildSide('SARDAKK_NORR', {
        FLAGSHIP: {
          count: 1,
          stats: {
            COMBAT: [6, 2],
            UNIT_ABILITIES: {},
            ABILITIES: [ability1, ability2],
          },
        },
      }),
      defender: emptySide(),
      abilities: { attacker: {}, defender: {} },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    const result = AbilitiesEngine.collectUnitAbilities(state, 'attacker')

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
      params: { isEnabled: true, uses: Infinity },
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
      attacker: buildSide('SARDAKK_NORR', {
        FLAGSHIP: {
          count: 2,
          stats: {
            COMBAT: [6, 2],
            UNIT_ABILITIES: {},
            ABILITIES: [mockAbility],
          },
        },
      }),
      defender: emptySide(),
      abilities: { attacker: {}, defender: {} },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    CombatState.fromData(state).params.runAbilities('START_OF_COMBAT_ROUND')

    expect(invokeCalls).toHaveLength(2)
  })

  it('should not invoke unit ability if unit destroyed', () => {
    const invokeCalls: number[] = []
    const mockAbility: Ability = {
      key: 'TEST_UNIT_ABILITY',
      name: 'Test',
      category: 'FACTION',
      params: { isEnabled: true, uses: Infinity },
      invoke: [
        {
          timing: 'START_OF_COMBAT_ROUND',
          call: ctx => {
            invokeCalls.push(1)
            // Destroy all units via Immer draft
            ctx.state.attacker.units = {} as SideStateData['units']
          },
        },
      ],
    }

    const state: CombatStateData = {
      attacker: buildSide('SARDAKK_NORR', {
        FLAGSHIP: {
          count: 2,
          stats: {
            COMBAT: [6, 2],
            UNIT_ABILITIES: {},
            ABILITIES: [mockAbility],
          },
        },
      }),
      defender: emptySide(),
      abilities: { attacker: {}, defender: {} },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    CombatState.fromData(state).params.runAbilities('START_OF_COMBAT_ROUND')

    // Only first unit should invoke (second destroyed by first)
    expect(invokeCalls).toHaveLength(1)
  })
})

describe('AFTER_DESTROY triggered by destroyUnit', () => {
  it('should trigger AFTER_DESTROY when an ability destroys units', () => {
    const afterDestroyCalls: {
      own: Record<string, UnitId[]>
      opponent: Record<string, UnitId[]>
    }[] = []

    const destroyAbility: Ability = {
      key: 'DESTROY_ABILITY',
      name: 'Destroy',
      category: 'GENERAL',
      params: { isEnabled: true, uses: Infinity },
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
      params: { isEnabled: true, uses: Infinity },
      invoke: [
        {
          timing: 'AFTER_DESTROY',
          call: (
            _ctx: AbilityCallContext,
            _params: Record<string, never>,
            context: OwnOpponentContext<Record<string, UnitId[]>>,
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
      attacker: buildSide('SARDAKK_NORR', {
        CRUISER: {
          count: 1,
          stats: {
            COMBAT: [7, 1],
            UNIT_ABILITIES: {},
            ABILITIES: [destroyAbility],
          },
        },
      }),
      defender: buildSide('FEDERATION_OF_SOL', {
        FIGHTER: {
          count: 1,
          stats: {
            COMBAT: [9, 1],
            UNIT_ABILITIES: {},
            ABILITIES: [afterDestroyAbility],
          },
        },
      }),
      abilities: { attacker: {}, defender: {} },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    CombatState.fromData(state).params.runAbilities('START_OF_COMBAT_ROUND')

    // Fighter should be destroyed
    expect(state.defender.units.FIGHTER).toBeUndefined()
    // AFTER_DESTROY should have been called (from the destroyed fighter's ability)
    expect(afterDestroyCalls).toHaveLength(1)
    // Fighter was destroyed (from fighter's perspective: own side lost it)
    expect(afterDestroyCalls[0].own.FIGHTER).toHaveLength(1)
  })

  it('should NOT trigger AFTER_DESTROY when no units are destroyed', () => {
    const afterDestroyCalls: unknown[] = []

    const noopAbility: Ability = {
      key: 'NOOP_ABILITY',
      name: 'Noop',
      category: 'GENERAL',
      params: { isEnabled: true, uses: Infinity },
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
      params: { isEnabled: true, uses: Infinity },
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
      attacker: buildSide('SARDAKK_NORR', {
        CRUISER: {
          count: 1,
          stats: {
            COMBAT: [7, 1],
            UNIT_ABILITIES: {},
            ABILITIES: [noopAbility, afterDestroyAbility],
          },
        },
      }),
      defender: buildSide('FEDERATION_OF_SOL', {
        FIGHTER: { count: 1, stats: { COMBAT: [9, 1], UNIT_ABILITIES: {} } },
      }),
      abilities: { attacker: {}, defender: {} },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    CombatState.fromData(state).params.runAbilities('START_OF_COMBAT_ROUND')

    expect(afterDestroyCalls).toHaveLength(0)
  })

  it('should NOT recursively trigger AFTER_DESTROY from AFTER_DESTROY handlers', () => {
    const afterDestroyCalls: unknown[] = []

    const destroyAbility: Ability = {
      key: 'DESTROY_ABILITY',
      name: 'Destroy',
      category: 'GENERAL',
      params: { isEnabled: true, uses: Infinity },
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
      params: { isEnabled: true, uses: Infinity },
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
      attacker: buildSide('SARDAKK_NORR', {
        FLAGSHIP: {
          count: 1,
          stats: {
            COMBAT: [6, 2],
            UNIT_ABILITIES: {},
            ABILITIES: [destroyAbility],
          },
        },
      }),
      defender: buildSide('FEDERATION_OF_SOL', {
        FIGHTER: {
          count: 1,
          stats: {
            COMBAT: [9, 1],
            UNIT_ABILITIES: {},
            ABILITIES: [afterDestroyAbility],
          },
        },
        CRUISER: { count: 1, stats: { COMBAT: [7, 1], UNIT_ABILITIES: {} } },
      }),
      abilities: { attacker: {}, defender: {} },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    CombatState.fromData(state).params.runAbilities('START_OF_COMBAT_ROUND')

    // Both units should be destroyed
    expect(state.defender.units.FIGHTER).toBeUndefined()
    expect(state.defender.units.CRUISER).toBeUndefined()
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
      params: { isEnabled: true, uses: Infinity },
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
      params: { isEnabled: true, uses: Infinity },
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
      attacker: buildSide('SARDAKK_NORR', {
        CRUISER: {
          count: 1,
          stats: {
            COMBAT: [7, 1],
            UNIT_ABILITIES: {},
            ABILITIES: [startOfCombatAbility, startOfRoundAbility],
          },
        },
      }),
      defender: emptySide(),
      abilities: { attacker: {}, defender: {} },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    CombatState.fromData(state).params.runAbilities([
      'START_OF_COMBAT_ROUND',
      'START_OF_COMBAT',
    ])

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
      params: { isEnabled: true, uses: Infinity },
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
      attacker: buildSide('SARDAKK_NORR', {
        CRUISER: {
          count: 1,
          stats: { COMBAT: [7, 1], UNIT_ABILITIES: {}, ABILITIES: [ability] },
        },
      }),
      defender: emptySide(),
      abilities: { attacker: {}, defender: {} },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    CombatState.fromData(state).params.runAbilities('START_OF_COMBAT_ROUND')

    expect(calls).toHaveLength(1)
  })
})
