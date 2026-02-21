import crimsonRebellionIcon from '@/assets/faction/crimson_rebellion.svg?raw'
import { declareParam } from '@/combat/abilities/declare-param'
import type { Ability } from '@/combat/abilities/types'
import {
  NON_FIGHTER_SHIPS,
  SHIPS,
  UNIT_DISPLAY_NAMES,
  UNIT_LIMITS,
} from '@/constants/units'
import type { UnitBaseType } from '@/types'

type Params = {
  isEnabled: boolean
  uses: number
  ships: Record<string, number>
  fleetPool: number
  shipPriority: string[]
}

const NON_FIGHTER_SET = new Set<UnitBaseType>(NON_FIGHTER_SHIPS)

export const fragmentReality: Ability<Params> = {
  key: 'FRAGMENT_REALITY',
  name: 'Fragment Reality',
  icon: crimsonRebellionIcon,
  category: 'FACTION',
  subcategory: 'HERO',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
    ships: {},
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
      isCallable: params =>
        Object.values(params.ships).some(count => count > 0),
      call: (ctx, params) => {
        const toPlace: Partial<Record<UnitBaseType, number>> = {}
        for (const [type, count] of Object.entries(params.ships)) {
          if (count > 0) toPlace[type as UnitBaseType] = count
        }
        ctx.api.own.placeUnits(toPlace)

        // Enforce fleet pool limit (fighters don't count)
        const totalNonFighter = ctx.api.own.countUnits(NON_FIGHTER_SHIPS)
        const excess = totalNonFighter - params.fleetPool
        if (excess <= 0) return

        // Remove lowest-priority ships first
        // Ships not in priority list are removed before listed ones
        const prioritySet = new Set(params.shipPriority)
        const allUnitTypes = Object.keys(
          ctx.api.own.getUnits(),
        ) as UnitBaseType[]
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
          if (!NON_FIGHTER_SET.has(type as UnitBaseType)) continue
          const unitType = type as UnitBaseType
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
      key: 'ships' as const,
      label: 'Ships',
      type: 'number-list' as const,
      items: SHIPS.map(type => ({
        label: UNIT_DISPLAY_NAMES[type],
        value: type,
        max: UNIT_LIMITS[type],
      })),
    },
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
