import { z } from 'zod/mini'

import { type UnitType } from '@/types'

import { declareParam } from '../../../combat/abilities-engine/declare-param'
import type { Ability } from '../../../combat/abilities-engine/types'

type Params = {
  targetPriority: UnitType[]
}

export const assaultCannon: Ability<Params> = {
  key: 'ASSAULT_CANNON',
  name: 'Assault Cannon',
  description:
    'At the start of a space combat in a system that contains 3 or more of your non-fighter ships, your opponent must destroy 1 of their non-fighter ships.',
  category: 'TECHNOLOGY',
  context: 'SPACE',
  paramsSchema: z.object({
    targetPriority: z.array(z.string()),
  }),
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

        ctx.api.opponent.destroyUnits(target)
      },
    },
  ],
  uiConfig: ctx => {
    return [
      {
        key: 'targetPriority' as const,
        type: 'order-list' as const,
        items: ctx.api.opponent.getUnitVariantsOptions({
          combatMode: 'SPACE',
          exclude: ['FIGHTER'],
        }),
      },
    ]
  },
}
