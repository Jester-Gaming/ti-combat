import { z } from 'zod/mini'

import { type Ability, declareParam, parseVariantId } from '@/combat'
import { UNIT_LIMITS } from '@/constants/units'
import type { UnitBaseType, UnitId, UnitType } from '@/types'

type Params = {
  isActive: boolean
  fleetPool: number
  shipPriority: string[]
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
  category: 'FACTION',
  subcategory: 'HERO',
  context: 'SPACE',
  paramsSchema: z.object({
    isActive: z.boolean(),
    fleetPool: z.number(),
    shipPriority: z.array(z.string()),
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    isActive: false,
    fleetPool: 8,
    shipPriority: declareParam({
      default: [],
      source: 'nonFighterShips',
      side: 'own',
      sort: 'desc',
    }),
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
      call: (ctx, params, units) => {
        const { ships, nonFighterShips } =
          ctx.api.own.getAbilityConfig('SETTINGS')
        const shipsSet = new Set<UnitBaseType>(ships)
        const nonFighterSet = new Set<UnitBaseType>(nonFighterShips)
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

        // Enforce fleet pool limit (fighters don't count)
        const totalNonFighter = ctx.api.own.countUnits(nonFighterShips)
        const excess = totalNonFighter - params.fleetPool
        if (excess <= 0) return

        // Build removal order: reverse of shipPriority (remove lowest priority first)
        // Non-fighter ships not in priority list are removed before listed ones
        const prioritySet = new Set(params.shipPriority)
        const allUnitTypes = ctx.api.own.getActiveBaseTypes()
        const unlisted = allUnitTypes.filter(
          t => nonFighterSet.has(t) && !prioritySet.has(t),
        )
        const removalOrder = [
          ...unlisted,
          ...[...params.shipPriority].reverse(),
        ]

        let remaining = excess
        for (const type of removalOrder) {
          if (remaining <= 0) break
          if (!nonFighterSet.has(type as UnitBaseType)) continue
          const unitType = type as UnitBaseType
          const unitAmount = ctx.api.own.countUnits(unitType)
          const toRemove = Math.min(remaining, unitAmount)
          for (let i = 0; i < toRemove; i++) {
            ctx.api.own.removeUnit(unitType)
            remaining--
          }
        }
      },
    },
  ],
  uiConfig: ctx => [
    {
      key: 'fleetPool' as const,
      label: 'Fleet Pool',
      type: 'number' as const,
      min: 1,
      max: 20,
    },
    {
      key: 'shipPriority' as const,
      label: 'Ship Keep Priority',
      type: 'order-list' as const,
      items: ctx.api.own.getUnitVariantsOptions({
        exclude: ['FIGHTER'],
        combatMode: 'SPACE',
      }),
    },
  ],
}
