import { declareParam } from '@/combat/abilities/declare-param'

import type { Ability } from '../../../combat/abilities/types'
import type { UnitType } from '../../../types'

type Params = {
  shipPriority: UnitType[]
}

export const gravleashManeuvers: Ability<Params> = {
  key: 'GRAVLEASH_MANEUVERS',
  name: 'Gravleash Maneuvers',
  category: 'FACTION',
  subcategory: 'BREAKTHROUGH',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
    shipPriority: declareParam({
      default: [],
      source: 'ships',
      side: 'opponent',
    }),
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => {
    return [
      {
        key: 'shipPriority' as const,
        label: 'Ship Priority',
        type: 'order-list' as const,
        items: ctx.api.own.getParticipatingVariantsOptions({
          combatMode: 'SPACE',
        }),
      },
    ]
  },
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (_params, _ctx, dice) => {
        return !dice.own.isEmpty()
      },
      call: (ctx, params, dice) => {
        const shipTypeCount = Object.keys(ctx.api.own.getUnits()).length
        const target = ctx.api.own.findUnitByPriority(params.shipPriority)

        if (shipTypeCount > 0 && target) {
          dice.own.modifyHitValue(-shipTypeCount, target)
        }
      },
    },
  ],
}
