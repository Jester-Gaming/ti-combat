import { describe, expect, it } from 'vitest'

import type { Ability } from '@/combat'

import { combatTest } from '../utils/combat-test'

/**
 * Engine tests: verify that dice-modifying abilities compose correctly.
 *
 * Four combinations:
 *   1. modifyHitValue + modifyHitValue  (both lower hit value)
 *   2. modifyHitValue + addDiceCount    (lower hit value + extra die)
 *   3. addDiceCount   + modifyHitValue  (extra die + lower hit value)
 *   4. addDiceCount   + addDiceCount    (both add extra dice)
 */

const modifyHitValueA: Ability = {
  key: 'TEST_MODIFY_HIT_A',
  name: 'Test Modify Hit A',
  params: { isEnabled: false, uses: Infinity },
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      call: ctx => {
        ctx.api.own.modifyHitValue(-1)
      },
    },
  ],
}

const modifyHitValueB: Ability = {
  key: 'TEST_MODIFY_HIT_B',
  name: 'Test Modify Hit B',
  params: { isEnabled: false, uses: Infinity },
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      call: ctx => {
        ctx.api.own.modifyHitValue(-1)
      },
    },
  ],
}

const addDiceCountA: Ability = {
  key: 'TEST_ADD_DICE_A',
  name: 'Test Add Dice A',
  params: { isEnabled: false, uses: Infinity },
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (_params, ctx) => !ctx.api.own.isDicePoolEmpty(),
      call: ctx => {
        ctx.api.own.addDiceCount(1, 'BEST')
      },
    },
  ],
}

const addDiceCountB: Ability = {
  key: 'TEST_ADD_DICE_B',
  name: 'Test Add Dice B',
  params: { isEnabled: false, uses: Infinity },
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (_params, ctx) => !ctx.api.own.isDicePoolEmpty(),
      call: ctx => {
        ctx.api.own.addDiceCount(1, 'BEST')
      },
    },
  ],
}

describe('engine: dice modification interactions', () => {
  // Cruiser: combat value 7, rolls 1 die

  it('modifyHitValue + modifyHitValue: both lower hit value', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { TEST_MODIFY_HIT_A: true, TEST_MODIFY_HIT_B: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      customAbilities: [modifyHitValueA, modifyHitValueB],
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Cruiser base 7, -1 -1 = 5, still 1 die
    expect(pool.attacker).toContainDice('CRUISER', [5, 1])
  })

  it('modifyHitValue + addDiceCount: lower hit value and extra die', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { TEST_MODIFY_HIT_A: true, TEST_ADD_DICE_A: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      customAbilities: [modifyHitValueA, addDiceCountA],
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Cruiser base 7, -1 = 6, 1 + 1 = 2 dice
    expect(pool.attacker).toContainDice('CRUISER', [6, 2])
  })

  it('addDiceCount + modifyHitValue: extra die and lower hit value', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { TEST_ADD_DICE_B: true, TEST_MODIFY_HIT_B: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      customAbilities: [addDiceCountB, modifyHitValueB],
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Cruiser base 7, -1 = 6, 1 + 1 = 2 dice
    expect(pool.attacker).toContainDice('CRUISER', [6, 2])
  })

  it('addDiceCount + addDiceCount: both add extra dice', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { TEST_ADD_DICE_A: true, TEST_ADD_DICE_B: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      customAbilities: [addDiceCountA, addDiceCountB],
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Cruiser base 7, 1 + 1 + 1 = 3 dice
    expect(pool.attacker).toContainDice('CRUISER', [7, 3])
  })
})
