import { declareParam } from '@/combat/abilities/declare-param'
import type { Ability } from '@/combat/abilities/types'
import { parseVariantId, unitMatchesVariant } from '@/combat/utils/unit-variant'
import type { UnitType } from '@/types'

type Params = {
  isEnabled: boolean
  targetPriority: UnitType[]
}

export const dimensionalSplicer: Ability<Params> = {
  key: 'DIMENSIONAL_SPLICER',
  name: 'Dimensional Splicer',
  category: 'FACTION',
  context: 'SPACE',
  params: {
    isEnabled: false,
    targetPriority: declareParam({
      default: [],
      source: 'ships',
      side: 'opponent',
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params, ctx) => {
        if (!params.isEnabled) return false
        return (
          ctx.api.opponent.findUnitByPriority(params.targetPriority) !==
          undefined
        )
      },
      call: (ctx, params: Params) => {
        for (const variantId of params.targetPriority) {
          const { type } = parseVariantId(variantId)
          const units = ctx.api.opponent.getUnits(type)
          if (
            units.length > 0 &&
            units.some(u => unitMatchesVariant(u, variantId))
          ) {
            ctx.api.opponent.addHits(1, [type])
            ctx.log(type)
            return
          }
        }
      },
    },
  ],
  uiConfig: ctx => {
    return [
      {
        key: 'targetPriority' as const,
        label: 'Target Priority',
        type: 'order-list' as const,
        items: ctx.api.opponent.getParticipatingVariantsOptions({
          combatMode: 'SPACE',
        }),
      },
    ]
  },
}
