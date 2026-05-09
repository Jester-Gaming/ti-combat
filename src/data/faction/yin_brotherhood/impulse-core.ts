import { z } from 'zod/mini'

import { type Ability, declareParam, parseVariantId } from '@/combat'
import { UNIT_PRICE } from '@/constants/units'
import type { UnitList } from '@/types'
import { UnitListBooleanSchema } from '@/types'

type Params = {
  sacrificePriority: UnitList<boolean>
  targetPriority: UnitList<boolean>
}

export const impulseCore: Ability<Params> = {
  key: 'IMPULSE_CORE',
  name: 'Impulse Core',
  description:
    "At the start of a space combat, you may destroy 1 of your cruisers or destroyers in the active system to produce 1 hit against your opponent's ships; that hit must be assigned by your opponent to 1 of their non-fighter ships if able.",
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
      source: 'nonFighterShips',
      side: 'own',
      defaultItemValue: true,
      filter: id => {
        const SACRIFICE_TYPES = new Set(['CRUISER', 'DESTROYER'])
        return SACRIFICE_TYPES.has(parseVariantId(id).type)
      },
    }),
    targetPriority: declareParam<UnitList<boolean>>({
      default: [],
      source: 'ships',
      side: 'opponent',
      defaultItemValue: true,
      sort: (a, b) => {
        if (a === 'FIGHTER') return 1
        if (b === 'FIGHTER') return -1
        return UNIT_PRICE[a] - UNIT_PRICE[b]
      },
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params, ctx) => {
        const sacrifice = ctx.api.own.findUnitByPriority(
          ctx.utils.getFlat(params.sacrificePriority),
          { includeVariants: false },
        )
        if (sacrifice === undefined) return false
        return (
          ctx.api.opponent.findUnitByPriority(
            ctx.utils.getFlat(params.targetPriority),
            { includeVariants: false },
          ) !== undefined
        )
      },
      call: (ctx, params) => {
        const sacrifice = ctx.api.own.findUnitByPriority(
          ctx.utils.getFlat(params.sacrificePriority),
          { includeVariants: false },
        )
        const target = ctx.api.opponent.findUnitByPriority(
          ctx.utils.getFlat(params.targetPriority),
          { includeVariants: false },
        )
        if (!sacrifice || !target) return

        ctx.api.opponent.addHits(1, [ctx.api.opponent.getUnitVariant(target)!])
        ctx.api.own.destroyUnits(sacrifice)
      },
    },
  ],
  uiConfig: ctx => {
    const nonFighter = ctx.api.opponent.getUnitVariantsOptions({
      exclude: ['FIGHTER'],
      combatMode: 'SPACE',
    })
    const fighters = ctx.api.opponent
      .getUnitVariantsOptions({
        include: ['FIGHTER'],
        combatMode: 'SPACE',
      })
      .map(item => ({
        ...item,
        stable: true,
      }))

    return [
      {
        key: 'sacrificePriority' as const,
        label: 'Sacrifice Priority',
        type: 'unit-list' as const,
        mode: 'checkbox' as const,
        sortable: true,
        items: ctx.api.own.getUnitVariantsOptions({
          include: ['CRUISER', 'DESTROYER'],
          combatMode: 'SPACE',
        }),
      },
      {
        key: 'targetPriority' as const,
        label: 'Target Priority',
        type: 'unit-list' as const,
        mode: 'checkbox' as const,
        sortable: true,
        items: [...nonFighter, ...fighters],
      },
    ]
  },
}
