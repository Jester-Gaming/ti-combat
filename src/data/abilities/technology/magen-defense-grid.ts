import { declareParam } from '@/combat/abilities/declare-param'
import type { Ability } from '@/combat/abilities/types'
import { parseVariantId, unitMatchesVariant } from '@/combat/utils/unit-variant'
import { STRUCTURES } from '@/constants/units'
import type { UnitType } from '@/types'

const STRUCTURE_SET = new Set(STRUCTURES)

type Params = {
  targetPriority: UnitType[]
}

export const magenDefenseGrid: Ability<Params> = {
  key: 'MAGEN_DEFENSE_GRID',
  name: 'Magen Defense Grid',
  category: 'TECHNOLOGY',
  context: 'GROUND',
  side: 'defender',
  params: {
    isEnabled: false,
    uses: Infinity,
    targetPriority: declareParam({
      default: [],
      source: 'groundForces',
      side: 'opponent',
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params, ctx) => {
        const hasStructure = ctx.api.own.countUnits(STRUCTURE_SET) > 0
        if (!hasStructure) return false
        return (
          ctx.api.opponent.findUnitByPriority(params.targetPriority) !==
          undefined
        )
      },
      call: (ctx, params) => {
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
        items: ctx.api.opponent.getUnitVariantsOptions({
          combatMode: 'GROUND',
        }),
      },
    ]
  },
}
