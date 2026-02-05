import { declareParam } from '@/combat/abilities/declare-param'
import { makeVariantId, parseVariantId } from '@/combat/utils/unit-variant'
import type { UnitType } from '@/types'

import type {
  Ability,
  AbilityReadContext,
} from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
  unitType: UnitType
}

export const viscountUnlenn: Ability<Params> = {
  key: 'VISCOUNT_UNLENN',
  name: '(Letnev) Viscount Unlenn',
  category: 'AGENT',
  context: 'SPACE',
  params: {
    isEnabled: false,
    unitType: declareParam<UnitType>({
      default: 'DESTROYER',
      source: 'nonFighterShips',
    }),
  },
  declareParamChange: params => [
    { key: 'subtypes', value: { name: 'Viscount', unitType: params.unitType } },
  ],
  headerUI: 'isEnabled',
  uiConfig: (ctx: AbilityReadContext) => {
    return [
      {
        key: 'unitType' as const,
        label: 'Unit Type',
        type: 'select' as const,
        items: ctx.api.own
          .getParticipatingVariantsOptions({
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
      isCallable: (params: Params, ctx: AbilityReadContext) => {
        const { type } = parseVariantId(params.unitType)
        return params.isEnabled && ctx.api.own.hasUnit(type)
      },
      call: (ctx, params: Params) => {
        ctx.api.own.addSubtype(params.unitType, 'Viscount')
        ctx.api.own.updateAbilityConfig({ isEnabled: false })
      },
    },
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (_params: Params, ctx: AbilityReadContext) => {
        const allUnits = ctx.api.own.getUnits()
        for (const units of Object.values(allUnits)) {
          if (units?.some(u => u.subtypes?.includes('Viscount'))) return true
        }
        return false
      },
      call: (ctx, params: Params, dice) => {
        const variantId = makeVariantId(params.unitType, ['Viscount'])
        const unit = ctx.api.own.findUnitByPriority([variantId])
        if (!unit) return
        dice.own.addDiceCount(1, unit)
        ctx.api.own.removeSubtype(variantId, 'Viscount')
        return
      },
    },
  ],
}
