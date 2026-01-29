import { describe, expect, it } from 'vitest'

import type { CombatStateData } from '../state/types'
import { collectUnitAbilities, runAbilities } from './abilities-tracker'
import type { Ability } from './types'

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
        attacker: { abilities: [] },
        defender: { abilities: [] },
      },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    const result = collectUnitAbilities(state, 'attacker')

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
        attacker: { abilities: [] },
        defender: { abilities: [] },
      },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    const result = collectUnitAbilities(state, 'attacker')

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
        attacker: { abilities: [] },
        defender: { abilities: [] },
      },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    const result = collectUnitAbilities(state, 'attacker')

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
          timing: 'START_OF_ROUND',
          call: ctx => {
            invokeCalls.push('called')
            return { state: ctx.state as CombatStateData & object }
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
        attacker: { abilities: [] },
        defender: { abilities: [] },
      },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    runAbilities('START_OF_ROUND', state)

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
          timing: 'START_OF_ROUND',
          call: ctx => {
            invokeCalls.push(1)
            // Destroy all units
            const newState = {
              ...ctx.state,
              attacker: {
                ...ctx.state.attacker,
                units: {},
              },
            }
            return { state: newState }
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
        attacker: { abilities: [] },
        defender: { abilities: [] },
      },
      combatMode: 'SPACE',
      currentPhase: { meta: 'SPACE_COMBAT', micro: 'START' },
    }

    runAbilities('START_OF_ROUND', state)

    // Only first unit should invoke (second destroyed by first)
    expect(invokeCalls).toHaveLength(1)
  })
})
