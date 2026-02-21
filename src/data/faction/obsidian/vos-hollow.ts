import obsidianIcon from '@/assets/faction/obsidian.svg?raw'
import { declareParam } from '@/combat/abilities/declare-param'
import type { Ability } from '@/combat/abilities/types'
import { parseVariantId } from '@/combat/utils/unit-variant'
import { SHIPS } from '@/constants/units'
import type { UnitBaseType, UnitId, UnitType } from '@/types'

type Params = {
  targetPriority: UnitType[]
}

const SHIPS_SET = new Set<UnitBaseType>(SHIPS)

function findDestroyedShipTypes(
  destroyed: Record<UnitType, UnitId[]>,
): Set<UnitBaseType> {
  const types = new Set<UnitBaseType>()
  for (const k in destroyed) {
    const key = k as UnitType
    if (destroyed[key]?.length > 0) {
      const { type } = parseVariantId(key)
      if (SHIPS_SET.has(type)) types.add(type)
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
        const ownDestroyedShips = findDestroyedShipTypes(units.own)
        for (const variantId of params.targetPriority) {
          const { type } = parseVariantId(variantId)
          if (ownDestroyedShips.has(type) && ctx.api.opponent.hasUnitType(type))
            return true
        }
        return false
      },
      call: (ctx, params, units) => {
        const ownDestroyedShips = findDestroyedShipTypes(units.own)
        for (const variantId of params.targetPriority) {
          const { type } = parseVariantId(variantId)
          if (
            ownDestroyedShips.has(type) &&
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
        label: 'Target Priority',
        type: 'priority-list' as const,
        items: ctx.api.opponent.getUnitVariantsOptions({
          combatMode: 'SPACE',
        }),
      },
    ]
  },
}
