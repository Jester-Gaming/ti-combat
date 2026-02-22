import { type Ability, declareParam } from '@/combat'
import { NON_FIGHTER_SHIPS, UNIT_DISPLAY_NAMES } from '@/constants/units'
import type { UnitBaseType } from '@/types'

type Params = {
  strategy: 'IMMEDIATELY' | 'ENOUGH_FLEET_POOL'
  ships: Record<string, number>
  fleetPool: number
  shipPriority: string[]
}

const ALLOWED_TYPES: UnitBaseType[] = ['FLAGSHIP', 'CRUISER', 'DESTROYER']

const NON_FIGHTER_SET = new Set<UnitBaseType>(NON_FIGHTER_SHIPS)

function getShipsToPlace(ships: Record<string, number>) {
  const toPlace: Partial<Record<UnitBaseType, number>> = {}
  const flagship = Math.min(ships.FLAGSHIP ?? 0, 1)
  if (flagship > 0) toPlace.FLAGSHIP = flagship

  const cruisers = ships.CRUISER ?? 0
  const destroyers = ships.DESTROYER ?? 0
  let remaining = 2
  const clampedCruisers = Math.min(cruisers, remaining)
  remaining -= clampedCruisers
  const clampedDestroyers = Math.min(destroyers, remaining)

  if (clampedCruisers > 0) toPlace.CRUISER = clampedCruisers
  if (clampedDestroyers > 0) toPlace.DESTROYER = clampedDestroyers

  return toPlace
}

function countToPlace(toPlace: Partial<Record<UnitBaseType, number>>) {
  let count = 0
  for (const [type, n] of Object.entries(toPlace)) {
    if (NON_FIGHTER_SET.has(type as UnitBaseType)) count += n
  }
  return count
}

export const overwingZeta: Ability<Params> = {
  key: 'OVERWING_ZETA',
  name: 'Overwing Zeta',
  category: 'FACTION',
  subcategory: 'HERO',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
    strategy: 'IMMEDIATELY',
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
      timing: 'START_OF_COMBAT_ROUND',
      isCallable: (params, ctx) => {
        const toPlace = getShipsToPlace(params.ships)
        if (Object.keys(toPlace).length === 0) return false

        if (params.strategy === 'ENOUGH_FLEET_POOL') {
          const currentNonFighter = ctx.api.own.countUnits(NON_FIGHTER_SHIPS)
          const adding = countToPlace(toPlace)
          return currentNonFighter + adding <= params.fleetPool
        }

        return true
      },
      call: (ctx, params) => {
        const toPlace = getShipsToPlace(params.ships)
        ctx.api.own.placeUnits(toPlace)

        if (params.strategy !== 'IMMEDIATELY') return

        // Enforce fleet pool limit (same as Fragment Reality)
        const totalNonFighter = ctx.api.own.countUnits(NON_FIGHTER_SHIPS)
        const excess = totalNonFighter - params.fleetPool
        if (excess <= 0) return

        const prioritySet = new Set(params.shipPriority)
        const allUnitTypes = ctx.api.own.getActiveBaseTypes()
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
          const toRemove = Math.min(remaining, ctx.api.own.countUnits(unitType))
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
      key: 'strategy' as const,
      label: 'Strategy',
      type: 'select' as const,
      items: [
        { label: 'Immediately (R1)', value: 'IMMEDIATELY' },
        { label: 'Enough Fleet Pool', value: 'ENOUGH_FLEET_POOL' },
      ],
    },
    {
      key: 'ships' as const,
      label: 'Ships',
      type: 'number-list' as const,
      items: ALLOWED_TYPES.map(type => ({
        label: UNIT_DISPLAY_NAMES[type],
        value: type,
        max: type === 'FLAGSHIP' ? 1 : 2,
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
