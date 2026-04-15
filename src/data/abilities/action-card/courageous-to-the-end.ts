import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { UnitType } from '@/types'

type Params = {
  ownPriority: UnitType[]
  targetPriority: UnitType[]
}

export const courageousToTheEnd: Ability<Params> = {
  key: 'COURAGEOUS_TO_THE_END',
  name: 'Courageous to the End',
  description:
    "After 1 of your ships is destroyed during a space combat: Roll 2 dice. For each result equal to or greater than that ship's combat value, your opponent must choose and destroy 1 of their ships.",
  category: 'ACTION_CARD',
  context: 'SPACE',
  paramsSchema: z.object({
    ownPriority: z.array(z.string()),
    targetPriority: z.array(z.string()),
  }),
  params: {
    isEnabled: false,
    uses: 1,
    ownPriority: declareParam({
      default: [],
      source: 'ships',
      side: 'own',
    }),
    targetPriority: declareParam({
      default: [],
      source: 'ships',
      side: 'opponent',
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'AFTER_DESTROY',
      isCallable: (params, ctx, context) => {
        let ownMatched = false
        for (const variantKey of params.ownPriority) {
          const ids = context.own[variantKey]
          if (ids && ids.length > 0) {
            ownMatched = true
            break
          }
        }
        if (!ownMatched) return false

        const targets = ctx.api.opponent.getAssignHitsTargets({
          hits: 2,
        })
        return targets.every(targetId => {
          const topVariant = ctx.api.opponent.getUnitVariant(targetId)!
          return params.targetPriority.includes(topVariant)
        })
      },
      call: (ctx, params, context) => {
        // Anchor the dice roll on the best (lowest combat value → easiest to
        // hit) destroyed own ship among those matching ownPriority.
        let combatValue: number | undefined
        for (const variantKey of params.ownPriority) {
          const ids = context.own[variantKey]
          if (!ids || ids.length === 0) continue
          const stats = ctx.api.own.getUnitStats(variantKey)
          if (!stats?.COMBAT) continue
          const v = stats.COMBAT[0]
          if (combatValue === undefined || v < combatValue) combatValue = v
        }

        if (combatValue === undefined) return

        ctx.rollDice([[combatValue, 2]], (branchCtx, hits) => {
          const total = hits[0]
          if (total === 0) return
          const targets = branchCtx.api.opponent.getAssignHitsTargets({
            hits: total,
          })
          branchCtx.api.opponent.destroyUnits(targets)
        })
      },
    },
  ],
  uiConfig: ctx => [
    {
      key: 'ownPriority' as const,
      label: 'Own Trigger Priority',
      type: 'checkbox-list' as const,
      items: ctx.api.own.getUnitVariantsOptions({ combatMode: 'SPACE' }),
    },
    {
      key: 'targetPriority' as const,
      label: 'Allowed Targets',
      type: 'checkbox-list' as const,
      items: ctx.api.opponent.getUnitVariantsOptions({ combatMode: 'SPACE' }),
    },
  ],
}
