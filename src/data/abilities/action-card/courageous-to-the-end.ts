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
      isCallable: (params, ctx, ids) => {
        const ownDestroyedVariants = new Set<string>()
        for (const id of ids) {
          const key = ctx.api.own.getVariantKey(id)
          if (key) ownDestroyedVariants.add(key)
        }
        const ownMatched = params.ownPriority.some(v =>
          ownDestroyedVariants.has(v),
        )
        if (!ownMatched) return false

        const targets = ctx.api.opponent.getAssignHitsTargets({
          hits: [2, 0],
        })
        return targets.every(targetId => {
          const topVariant = ctx.api.opponent.getUnitVariant(targetId)!
          return params.targetPriority.includes(topVariant)
        })
      },
      call: (ctx, params, ids) => {
        // Anchor the dice roll on the best (lowest combat value → easiest to
        // hit) destroyed own ship among those matching ownPriority.
        const ownDestroyedVariants = new Set<string>()
        for (const id of ids) {
          const key = ctx.api.own.getVariantKey(id)
          if (key) ownDestroyedVariants.add(key)
        }
        let combatValue: number | undefined
        for (const variantKey of params.ownPriority) {
          if (!ownDestroyedVariants.has(variantKey)) continue
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
            hits: [total, 0],
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
