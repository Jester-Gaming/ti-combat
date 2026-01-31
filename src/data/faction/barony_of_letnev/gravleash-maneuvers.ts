import { getVariantDisplayName } from '@/combat/utils/unit-variant'

import type {
  Ability,
  AbilityReadContext,
  DiceContext,
  DiceReadContext,
} from '../../../combat/abilities/types'
import type { UnitType } from '../../../types'

type Params = {
  isEnabled: boolean
  shipPriority: UnitType[]
}

export const gravleashManeuvers: Ability<Params> = {
  key: 'GRAVLEASH_MANEUVERS',
  name: 'Breakthrough',
  category: 'FACTION',
  defaultParams: {
    isEnabled: false,
    shipPriority: [
      'FLAGSHIP',
      'WAR_SUN',
      'DREADNOUGHT',
      'CRUISER',
      'CARRIER',
      'DESTROYER',
      'FIGHTER',
    ],
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => {
    const variants = ctx.api.own.getParticipatingVariants()
    const items = variants.map(id => ({
      label: getVariantDisplayName(id),
      value: id,
    }))

    return [
      {
        key: 'shipPriority' as const,
        label: 'Ship Priority',
        type: 'order-list' as const,
        items: items,
      },
    ]
  },
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (
        params: Params,
        _ctx: AbilityReadContext,
        dice: DiceReadContext,
      ) => {
        return params.isEnabled && !dice.own.isEmpty()
      },
      call: (ctx, params: Params, dice: DiceContext) => {
        const shipTypeCount = Object.keys(ctx.api.own.getUnits()).length
        const target = ctx.api.own.findUnitByPriority(params.shipPriority)

        if (shipTypeCount > 0 && target) {
          dice.own.modifyHitValue(-shipTypeCount, target)
        }
      },
    },
  ],
}
