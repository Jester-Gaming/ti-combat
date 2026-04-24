import { z } from 'zod/mini'

import { type Ability, parseVariantId } from '@/combat'
import { UNIT_LIMITS } from '@/constants/units'
import type { UnitBaseType } from '@/types'

type Params = {
  isActive: boolean
}

export const sleeperCell: Ability<Params> = {
  key: 'SLEEPER_CELL',
  name: 'Sleeper Cell',
  description:
    "At the start of a space combat that you are participating in: You may purge this card; if you do, for each other player's ship that is destroyed during this combat, place 1 ship of that type from your reinforcements in the active system.",
  category: 'FACTION',
  subcategory: 'HERO',
  context: 'SPACE',
  paramsSchema: z.object({
    isActive: z.boolean(),
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    isActive: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      call: ctx => {
        ctx.api.own.updateAbilityConfig({ isActive: true })
      },
    },
    {
      timing: 'DESTROY',
      isCallable: (params, ctx, ids) => {
        if (!params.isActive) return false
        const { ships } = ctx.api.own.getAbilityConfig('SETTINGS')
        const shipsSet = new Set<UnitBaseType>(ships)
        for (const id of ids) {
          const variantKey = ctx.api.opponent.getVariantKey(id)
          if (!variantKey) continue
          const { type } = parseVariantId(variantKey)
          if (shipsSet.has(type)) return true
        }
        return false
      },
      call: (ctx, _params, ids) => {
        const { ships } = ctx.api.own.getAbilityConfig('SETTINGS')
        const shipsSet = new Set<UnitBaseType>(ships)
        const destroyed: Partial<Record<UnitBaseType, number>> = {}
        for (const id of ids) {
          const variantKey = ctx.api.opponent.getVariantKey(id)
          if (!variantKey) continue
          const { type } = parseVariantId(variantKey)
          if (!shipsSet.has(type)) continue
          destroyed[type] = (destroyed[type] ?? 0) + 1
        }

        // Cap placement at unit limits
        const toPlace: Partial<Record<UnitBaseType, number>> = {}
        for (const [type, count] of Object.entries(destroyed)) {
          const unitType = type as UnitBaseType
          const existing = ctx.api.own.countUnits(unitType)
          const canPlace = Math.max(0, UNIT_LIMITS[unitType] - existing)
          if (canPlace > 0) toPlace[unitType] = Math.min(count, canPlace)
        }
        ctx.api.own.placeUnits(toPlace)
      },
    },
  ],
}
