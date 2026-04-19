import { z } from 'zod/mini'

import { type Ability, declareParam, parseVariantId } from '@/combat'
import { UNIT_DISPLAY_NAMES } from '@/constants/units'
import type { UnitBaseType, UnitType } from '@/types'

type Params = {
  shipPriority: UnitBaseType[]
  _destroyedShipTypes: UnitBaseType[]
}

export const salvageOperations: Ability<Params> = {
  key: 'SALVAGE_OPERATIONS',
  name: 'Salvage Operations',
  description:
    'After you win or lose a space combat, gain 1 trade good; if you won the combat, you may also produce 1 ship in that system of any ship type that was destroyed during the combat.',
  category: 'FACTION',
  subcategory: 'TECHNOLOGY',
  context: 'SPACE',
  paramsSchema: z.object({
    shipPriority: z.array(z.string()),
    _destroyedShipTypes: z.array(z.string()),
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    shipPriority: declareParam({
      default: [],
      source: 'ships',
    }),
    _destroyedShipTypes: [],
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => {
    const { ships } = ctx.api.own.getAbilityConfig('SETTINGS')
    return [
      {
        key: 'shipPriority' as const,
        label: 'Ship Priority',
        type: 'order-list' as const,
        items: ships.map(s => ({ label: UNIT_DISPLAY_NAMES[s], value: s })),
      },
    ]
  },
  invoke: [
    {
      timing: 'DESTROY',
      call: (ctx, params, units) => {
        const { ships } = ctx.api.own.getAbilityConfig('SETTINGS')
        const shipsSet = new Set<UnitBaseType>(ships)
        const collected = new Set<UnitBaseType>(params._destroyedShipTypes)
        for (const side of [units.own, units.opponent]) {
          for (const k in side) {
            const key = k as UnitType
            const { type } = parseVariantId(key)
            if (shipsSet.has(type) && side[key]?.length > 0) {
              collected.add(type)
            }
          }
        }
        ctx.api.own.updateAbilityConfig({
          _destroyedShipTypes: [...collected],
        })
      },
    },
    {
      timing: 'END_OF_COMBAT',
      isCallable: (params, ctx) => {
        const { ships: ownShips } = ctx.api.own.getAbilityConfig('SETTINGS')

        if (params._destroyedShipTypes.length === 0) return false
        if (
          ctx.api.own.countUnits(ownShips as UnitType[], {
            includeVariants: true,
          }) === 0
        )
          return false

        const destroyed = new Set<UnitBaseType>(params._destroyedShipTypes)
        return params.shipPriority.some(t => destroyed.has(t))
      },
      call: (ctx, params) => {
        const destroyed = new Set<UnitBaseType>(params._destroyedShipTypes)
        for (const t of params.shipPriority) {
          if (destroyed.has(t)) {
            ctx.api.own.placeUnits({ [t]: 1 })
            return
          }
        }
      },
    },
  ],
}
