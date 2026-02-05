import { declareParam } from '@/combat/abilities/declare-param'
import type { Ability } from '@/combat/abilities/types'
import { parseVariantId } from '@/combat/utils/unit-variant'

type Params = {
  isEnabled: boolean
  sacrificePriority: string[]
  targetPriority: string[]
}

const SACRIFICE_TYPES = new Set(['CRUISER', 'DESTROYER'])

export const impulseCore: Ability<Params> = {
  key: 'IMPULSE_CORE',
  name: 'Impulse Core',
  category: 'FACTION',
  context: 'SPACE',
  params: {
    isEnabled: false,
    sacrificePriority: declareParam({
      default: [],
      source: 'ships',
      side: 'own',
      filter: id => SACRIFICE_TYPES.has(parseVariantId(id).type),
    }),
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
      isCallable: (params, ctx) => {
        if (!params.isEnabled) return false
        const sacrifice = ctx.api.own.findUnitByPriority(
          params.sacrificePriority,
        )
        if (!sacrifice) return false
        return (
          ctx.api.opponent.findUnitByPriority(params.targetPriority) !==
          undefined
        )
      },
      call: (ctx, params: Params) => {
        const sacrifice = ctx.api.own.findUnitByPriority(
          params.sacrificePriority,
        )
        if (!sacrifice) return

        ctx.api.own.destroyUnit(sacrifice)

        for (const variantId of params.targetPriority) {
          if (ctx.api.opponent.findUnitByPriority([variantId])) {
            ctx.api.opponent.addHits(1, [parseVariantId(variantId).type])
            return
          }
        }
      },
    },
  ],
  uiConfig: ctx => {
    return [
      {
        key: 'sacrificePriority' as const,
        label: 'Sacrifice Priority',
        type: 'priority-list' as const,
        items: ctx.api.own.getParticipatingVariantsOptions({
          include: ['CRUISER', 'DESTROYER'],
          combatMode: 'SPACE',
        }),
      },
      {
        key: 'targetPriority' as const,
        label: 'Target Priority',
        type: 'priority-list' as const,
        items: ctx.api.opponent.getParticipatingVariantsOptions({
          exclude: ['FIGHTER'],
          combatMode: 'SPACE',
        }),
      },
    ]
  },
}
