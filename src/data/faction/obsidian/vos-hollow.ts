import { z } from 'zod/mini'

import obsidianIcon from '@/assets/faction/obsidian.svg?raw'
import { type Ability, declareParam, parseVariantId } from '@/combat'
import type { UnitBaseType, UnitId, UnitType } from '@/types'

type Params = {
  targetPriority: UnitType[]
}

function findDestroyedShipTypes(
  destroyed: Record<UnitType, UnitId[]>,
  ships: UnitBaseType[],
): Set<UnitBaseType> {
  const shipsSet = new Set<UnitBaseType>(ships)
  const types = new Set<UnitBaseType>()
  for (const k in destroyed) {
    const key = k as UnitType
    if (destroyed[key]?.length > 0) {
      const { type } = parseVariantId(key)
      if (shipsSet.has(type)) types.add(type)
    }
  }
  return types
}

export const vosHollow: Ability<Params> = {
  key: 'VOS_HOLLOW',
  name: 'Vos Hollow',
  icon: obsidianIcon,
  category: 'AGENT',
  context: 'SPACE',
  paramsSchema: z.object({
    targetPriority: z.array(z.string()),
  }),
  params: {
    isEnabled: false,
    uses: 1,
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
      isCallable: (params, ctx, units) => {
        const { ships: ownShips } = ctx.api.own.getAbilityConfig('SETTINGS')
        const { ships: opponentShips } =
          ctx.api.opponent.getAbilityConfig('SETTINGS')
        const ownDestroyedShips = findDestroyedShipTypes(units.own, ownShips)
        const opponentShipsSet = new Set<UnitBaseType>(opponentShips)
        for (const variantId of params.targetPriority) {
          const { type } = parseVariantId(variantId)
          if (
            ownDestroyedShips.has(type) &&
            opponentShipsSet.has(type) &&
            ctx.api.opponent.hasUnitType(type)
          )
            return true
        }
        return false
      },
      call: (ctx, params, units) => {
        const { ships: ownShips } = ctx.api.own.getAbilityConfig('SETTINGS')
        const { ships: opponentShips } =
          ctx.api.opponent.getAbilityConfig('SETTINGS')
        const ownDestroyedShips = findDestroyedShipTypes(units.own, ownShips)
        const opponentShipsSet = new Set<UnitBaseType>(opponentShips)
        for (const variantId of params.targetPriority) {
          const { type } = parseVariantId(variantId)
          if (
            ownDestroyedShips.has(type) &&
            opponentShipsSet.has(type) &&
            ctx.api.opponent.hasUnitType(type)
          ) {
            ctx.api.opponent.destroyUnit(type)
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
        type: 'priority-list' as const,
        items: ctx.api.opponent.getUnitVariantsOptions({
          combatMode: 'SPACE',
        }),
      },
    ]
  },
}
