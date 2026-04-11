import { z } from 'zod/mini'

import { type Ability, parseVariantId } from '@/combat'
import { UNIT_LIMITS } from '@/constants/units'
import type { UnitBaseType, UnitId, UnitType } from '@/types'

type Params = {
  isActive: boolean
}

function collectDestroyedShips(
  destroyed: Record<string, UnitId[]>,
  ships: Set<UnitBaseType>,
): Partial<Record<UnitBaseType, number>> {
  const counts: Partial<Record<UnitBaseType, number>> = {}
  for (const k in destroyed) {
    const key = k as UnitType
    const { type } = parseVariantId(key)
    if (ships.has(type)) {
      counts[type] = (counts[type] ?? 0) + destroyed[key].length
    }
  }
  return counts
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
      isCallable: (params, ctx, units) => {
        if (!params.isActive) return false
        const { ships } = ctx.api.own.getAbilityConfig('SETTINGS')
        const shipsSet = new Set<UnitBaseType>(ships)
        for (const k in units.opponent) {
          const key = k as UnitType
          if (units.opponent[key]?.length > 0) {
            const { type } = parseVariantId(key)
            if (shipsSet.has(type)) return true
          }
        }
        return false
      },
      call: (ctx, _params, units) => {
        const { ships } = ctx.api.own.getAbilityConfig('SETTINGS')
        const shipsSet = new Set<UnitBaseType>(ships)
        const destroyed = collectDestroyedShips(units.opponent, shipsSet)

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
