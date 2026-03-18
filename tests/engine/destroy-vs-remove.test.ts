import { describe, expect, it } from 'vitest'

import type { Ability } from '@/combat'

import { combatTest } from '../utils/combat-test'

/**
 * Engine test: verify that WHEN_DESTROY fires on unit destruction
 * (via destroyUnit) but NOT on unit removal (via removeUnit).
 */

let whenDestroyFired = false

const destroyOpponentCruiser: Ability = {
  key: 'TEST_DESTROY_CRUISER',
  name: 'Test Destroy Cruiser',
  category: 'TEST',
  params: { isEnabled: false, uses: 1 },
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      isCallable: (_params, ctx) => ctx.api.opponent.hasUnitType('CRUISER'),
      call: ctx => {
        ctx.api.opponent.destroyUnit('CRUISER')
      },
    },
  ],
}

const removeOpponentCruiser: Ability = {
  key: 'TEST_REMOVE_CRUISER',
  name: 'Test Remove Cruiser',
  category: 'TEST',
  params: { isEnabled: false, uses: 1 },
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      isCallable: (_params, ctx) => ctx.api.opponent.hasUnitType('CRUISER'),
      call: ctx => {
        ctx.api.opponent.removeUnit('CRUISER')
      },
    },
  ],
}

const reactToDestroy: Ability = {
  key: 'TEST_REACT_DESTROY',
  name: 'Test React to Destroy',
  category: 'TEST',
  params: { isEnabled: false, uses: Infinity },
  invoke: [
    {
      timing: 'WHEN_DESTROY',
      side: 'OWN',
      isCallable: (_params, _ctx, context) =>
        Object.keys(context.own).length > 0,
      call: () => {
        whenDestroyFired = true
      },
    },
  ],
}

describe('engine: destroy vs remove', () => {
  beforeEach(() => {
    whenDestroyFired = false
  })

  it('WHEN_DESTROY fires when destroyUnit is called', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { TEST_DESTROY_CRUISER: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { TEST_REACT_DESTROY: true },
      },
      customAbilities: [destroyOpponentCruiser, reactToDestroy],
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(whenDestroyFired).toBe(true)
    expect(t.abilityLog('TEST_REACT_DESTROY')).not.toHaveLength(0)
    expect(t.defender.units.CRUISER).toBeUndefined()
  })

  it('WHEN_DESTROY does NOT fire when removeUnit is called', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { TEST_REMOVE_CRUISER: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { TEST_REACT_DESTROY: true },
      },
      customAbilities: [removeOpponentCruiser, reactToDestroy],
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(whenDestroyFired).toBe(false)
    expect(t.abilityLog('TEST_REACT_DESTROY')).toHaveLength(0)
    expect(t.defender.units.CRUISER).toBeUndefined()
  })
})
