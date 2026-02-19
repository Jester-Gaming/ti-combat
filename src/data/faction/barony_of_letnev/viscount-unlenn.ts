import baronyOfLetnevIcon from '@/assets/faction/barony_of_letnev.svg?raw'
import { declareParam } from '@/combat/abilities/declare-param'
import { getUnitLocator } from '@/combat/utils/compact-units'
import { makeVariantId, parseVariantId } from '@/combat/utils/unit-variant'
import type { UnitType } from '@/types'

import type { Ability } from '../../../combat/abilities/types'

type Params = {
  unitType: UnitType
}

export const viscountUnlenn: Ability<Params> = {
  key: 'VISCOUNT_UNLENN',
  name: 'Viscount Unlenn',
  icon: baronyOfLetnevIcon,
  category: 'AGENT',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 2,
    unitType: declareParam<UnitType>({
      default: 'DESTROYER',
      source: 'nonFighterShips',
    }),
  },
  declareParamChange: params => [
    { key: 'subtypes', value: { name: 'Viscount', unitType: params.unitType } },
  ],
  headerUI: 'isEnabled',
  uiConfig: ctx => {
    return [
      {
        key: 'unitType' as const,
        label: 'Unit Type',
        type: 'select' as const,
        items: ctx.api.own
          .getUnitVariantsOptions({
            exclude: ['FIGHTER'],
            excludeSubtypes: ['Viscount'],
            combatMode: 'SPACE',
          })
          .reverse(),
      },
    ]
  },
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      isCallable: (params, ctx) => {
        const { type } = parseVariantId(params.unitType)
        return ctx.api.own.hasUnit(type)
      },
      call: (ctx, params) => {
        ctx.api.own.addSubtype(params.unitType, 'Viscount')
      },
    },
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (_params, ctx) => {
        const allUnits = ctx.api.own.getUnits()
        for (const units of Object.values(allUnits)) {
          if (units?.some(u => u.subtypes?.includes('Viscount'))) return true
        }
        return false
      },
      call: (ctx, params, dice) => {
        const variantId = makeVariantId(params.unitType, ['Viscount'])
        const unit = ctx.api.own.findUnitByPriority([variantId])
        if (!unit) return
        dice.own.addDiceCount(1, getUnitLocator(unit)!)
        ctx.api.own.removeSubtype(variantId, 'Viscount')
        return
      },
    },
  ],
}
