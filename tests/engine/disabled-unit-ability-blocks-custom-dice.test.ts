import { describe, expect, it } from 'vitest'

import type { Ability } from '@/combat'
import type { UnitId } from '@/types'

import { combatTest } from '../utils/combat-test'

/**
 * Engine test: when a unit ability is disabled, config-level abilities
 * that add custom dice at that timing should also be blocked.
 *
 * Real-world case: ENTROPIC_SCAR disables SPACE_CANNON, but GEOFORM
 * (a config ability) still adds dice via addDiceGroup at
 * BEFORE_UNIT_ABILITY_ROLL with context SPACE_CANNON_OFFENSE.
 * Those dice should not fire when the unit ability is disabled.
 */

const disableSpaceCannon: Ability = {
  key: 'TEST_DISABLE_SC',
  name: 'Test Disable Space Cannon',
  category: 'TEST',
  params: { isEnabled: false, uses: Infinity },
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.own.setUnitAbilityCannotBeUsed('SPACE_CANNON', 'TEST')
      },
    },
  ],
}

const addCustomDiceAtSC: Ability = {
  key: 'TEST_CUSTOM_SC_DICE',
  name: 'Test Custom SC Dice',
  category: 'TEST',
  params: { isEnabled: false, uses: Infinity },
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: ['SPACE_CANNON_OFFENSE', 'SPACE_CANNON_DEFENSE'],
      call: (_ctx, _params, dice) => {
        dice.own.addDiceGroup('TEST_CUSTOM_SC_DICE', 0 as UnitId, [5, 3])
      },
    },
  ],
}

describe('engine: disabled unit ability blocks custom dice', () => {
  it('custom dice should not fire when the unit ability is disabled', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1 },
        abilities: {
          TEST_DISABLE_SC: true,
          TEST_CUSTOM_SC_DICE: true,
        },
      },
      customAbilities: [disableSpaceCannon, addCustomDiceAtSC],
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // PDS Space Cannon should be disabled
    expect(pool.defender?.PDS).toBeUndefined()
    // Custom dice added via addDiceGroup should also be blocked
    expect(pool.defender).not.toContainDice('TEST_CUSTOM_SC_DICE')
  })
})
