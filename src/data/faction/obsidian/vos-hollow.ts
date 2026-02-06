import { declareParam } from '@/combat/abilities/declare-param'
import type { Ability, DestroyedUnit } from '@/combat/abilities/types'
import { parseVariantId } from '@/combat/utils/unit-variant'
import { SHIPS } from '@/constants/units'
import type { UnitType } from '@/types'

type Params = {
  isEnabled: boolean
  targetPriority: string[]
}

const SHIPS_SET = new Set<UnitType>(SHIPS)

function findDestroyedShipTypes(destroyed: DestroyedUnit[]): Set<UnitType> {
  const types = new Set<UnitType>()
  for (const { type } of destroyed) {
    if (SHIPS_SET.has(type)) types.add(type)
  }
  return types
}

export const vosHollow: Ability<Params> = {
  key: 'VOS_HOLLOW',
  name: '(Obsidian) Vos Hollow',
  category: 'AGENT',
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
      timing: 'AFTER_DESTROY',
      isCallable: (params, ctx, units) => {
        if (!params.isEnabled) return false
        const ownDestroyedShips = findDestroyedShipTypes(units.own)
        for (const variantId of params.targetPriority) {
          const { type } = parseVariantId(variantId)
          if (ownDestroyedShips.has(type) && ctx.api.opponent.hasUnit(type))
            return true
        }
        return false
      },
      call: (ctx, params, units) => {
        const ownDestroyedShips = findDestroyedShipTypes(units.own)
        for (const variantId of params.targetPriority) {
          const { type } = parseVariantId(variantId)
          if (ownDestroyedShips.has(type) && ctx.api.opponent.hasUnit(type)) {
            ctx.api.opponent.destroyUnit(type)
            ctx.api.own.updateAbilityConfig({ isEnabled: false })
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
        items: ctx.api.opponent.getParticipatingVariantsOptions({
          combatMode: 'SPACE',
        }),
      },
    ]
  },
}
