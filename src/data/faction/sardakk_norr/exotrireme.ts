import { z } from 'zod/mini'

import {
  type Ability,
  type AbilityReadContext,
  declareParam,
  parseVariantId,
} from '@/combat'
import type { UnitList } from '@/types'
import { UnitListBooleanSchema } from '@/types'

type Params = {
  sacrificePriority: UnitList<boolean>
  targetPriority: UnitList<boolean>
}

export const exotrireme: Ability<Params> = {
  key: 'EXOTRIREME',
  name: 'Exotrireme II',
  description:
    'This unit cannot be destroyed by Direct Hit action cards. After a round of space combat, you may destroy this unit to destroy up to 2 ships in this system.',
  context: 'SPACE',
  paramsSchema: z.object({
    sacrificePriority: UnitListBooleanSchema,
    targetPriority: UnitListBooleanSchema,
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    sacrificePriority: declareParam({
      default: [] as UnitList<boolean>,
      source: 'ships',
      side: 'own',
      defaultItemValue: true,
      filter: id => parseVariantId(id).type === 'DREADNOUGHT',
    }),
    targetPriority: declareParam<UnitList<boolean>>({
      default: [],
      source: 'ships',
      side: 'opponent',
      sort: 'desc',
      defaultItemValue: true,
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'AFTER_COMBAT_ROUND',
      isCallable: (params, ctx) => {
        if (
          ctx.api.opponent.findUnitByPriority(
            ctx.utils.getFlat(params.targetPriority),
          ) === undefined
        ) {
          return false
        }
        return isHighestPrioritySacrifice(params, ctx)
      },
      call: (ctx, params) => {
        const self = ctx.getUnit()
        const targets = ctx.api.opponent.findUnitByPriority(
          ctx.utils.getFlat(params.targetPriority),
          2,
        )

        if (targets.length > 0) ctx.api.opponent.destroyUnits(targets)
        ctx.api.own.destroyUnits(self)
      },
    },
  ],
  uiConfig: ctx => [
    {
      key: 'uses' as const,
      label: 'Uses',
      type: 'number' as const,
      min: 0,
    },
    {
      key: 'sacrificePriority' as const,
      label: 'Sacrifice Priority',
      type: 'unit-list' as const,
      mode: 'checkbox' as const,
      sortable: true,
      items: ctx.api.own.getUnitVariantsOptions({
        include: ['DREADNOUGHT'],
        combatMode: 'SPACE',
      }),
    },
    {
      key: 'targetPriority' as const,
      label: 'Target Priority',
      type: 'unit-list' as const,
      mode: 'checkbox' as const,
      sortable: true,
      items: ctx.api.opponent.getUnitVariantsOptions({
        combatMode: 'SPACE',
      }),
    },
  ],
}

function isHighestPrioritySacrifice(
  params: Params,
  ctx: AbilityReadContext,
): boolean {
  const myUnitId = ctx.getUnit()

  for (const variantId of ctx.utils.getFlat(params.sacrificePriority)) {
    const units = ctx.api.own.getUnits(variantId)
    if (units.length === 0) continue

    return units[0] === myUnitId
  }

  return false
}
