import { type UnitType } from '@/types'

import { declareParam } from '../../../combat/abilities/declare-param'
import type { Ability } from '../../../combat/abilities/types'

type Params = {
  targetPriority: UnitType[]
}

export const assaultCannon: Ability<Params> = {
  key: 'ASSAULT_CANNON',
  name: 'Assault Cannon',
  category: 'TECHNOLOGY',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
    targetPriority: declareParam({
      default: [],
      source: 'nonFighterShips',
      side: 'opponent',
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (_, ctx) => {
        const { nonFighterShips } = ctx.api.own.getAbilityConfig('SETTINGS')
        const nonFighterCount = ctx.api.own.countUnits(nonFighterShips)
        if (nonFighterCount < 3) return false

        return true
      },
      call: (ctx, params) => {
        const target = ctx.api.opponent.findUnitByPriority(
          params.targetPriority,
        )!

        ctx.api.opponent.destroyUnit(target)
      },
    },
  ],
  uiConfig: ctx => {
    return [
      {
        key: 'targetPriority' as const,
        label: 'Target Priority',
        type: 'order-list' as const,
        items: ctx.api.opponent.getUnitVariantsOptions({
          combatMode: 'SPACE',
          exclude: ['FIGHTER'],
        }),
      },
    ]
  },
}
