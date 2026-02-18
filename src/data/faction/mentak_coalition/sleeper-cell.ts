import { declareParam } from '@/combat/abilities/declare-param'
import type { Ability, DestroyedUnit } from '@/combat/abilities/types'
import { NON_FIGHTER_SHIPS, SHIPS, UNIT_LIMITS } from '@/constants/units'
import type { UnitType } from '@/types'

type Params = {
  isActive: boolean
  fleetPool: number
  shipPriority: string[]
}

const SHIPS_SET = new Set<UnitType>(SHIPS)
const NON_FIGHTER_SET = new Set<UnitType>(NON_FIGHTER_SHIPS)

function collectDestroyedShips(
  destroyed: DestroyedUnit[],
): Partial<Record<UnitType, number>> {
  const counts: Partial<Record<UnitType, number>> = {}
  for (const { type } of destroyed) {
    if (SHIPS_SET.has(type)) {
      counts[type] = (counts[type] ?? 0) + 1
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
      isCallable: (params, _ctx, units) => {
        if (!params.isActive) return false
        return units.opponent.some(u => SHIPS_SET.has(u.type))
      },
      call: (ctx, params, units) => {
        const destroyed = collectDestroyedShips(units.opponent)

        // Cap placement at unit limits
        const toPlace: Partial<Record<UnitType, number>> = {}
        for (const [type, count] of Object.entries(destroyed)) {
          const unitType = type as UnitType
          const existing = ctx.api.own.getUnits(unitType).length
          const canPlace = Math.max(0, UNIT_LIMITS[unitType] - existing)
          if (canPlace > 0) toPlace[unitType] = Math.min(count, canPlace)
        }
        ctx.api.own.addUnit(toPlace)

        // Enforce fleet pool limit (fighters don't count)
        const totalNonFighter = ctx.api.own.countUnits(NON_FIGHTER_SET)
        const excess = totalNonFighter - params.fleetPool
        if (excess <= 0) return

        // Build removal order: reverse of shipPriority (remove lowest priority first)
        // Non-fighter ships not in priority list are removed before listed ones
        const prioritySet = new Set(params.shipPriority)
        const allUnitTypes = Object.keys(ctx.api.own.getUnits()) as UnitType[]
        const unlisted = allUnitTypes.filter(
          t => NON_FIGHTER_SET.has(t) && !prioritySet.has(t),
        )
        const removalOrder = [
          ...unlisted,
          ...[...params.shipPriority].reverse(),
        ]

        let remaining = excess
        for (const type of removalOrder) {
          if (remaining <= 0) break
          if (!NON_FIGHTER_SET.has(type as UnitType)) continue
          const unitType = type as UnitType
          const unitList = ctx.api.own.getUnits(unitType)
          const toRemove = Math.min(remaining, unitList.length)
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
