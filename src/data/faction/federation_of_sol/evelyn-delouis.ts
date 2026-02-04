import { declareParam } from '@/combat/abilities/declare-param'
import {
  getVariantDisplayName,
  makeVariantId,
  parseVariantId,
} from '@/combat/utils/unit-variant'
import type { UnitType } from '@/types'

import type {
  Ability,
  AbilityReadContext,
} from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
  unitType: UnitType
}

export const evelynDelouis: Ability<Params> = {
  key: 'EVELYN_DELOUIS',
  name: '(Sol) Evelyn DeLouis',
  category: 'AGENT',
  context: 'GROUND',
  params: {
    isEnabled: false,
    unitType: declareParam<UnitType>({
      default: 'INFANTRY',
      source: 'groundForces',
    }),
  },
  declareParamChange: params => [
    { key: 'subtypes', value: { name: 'Evelyn', unitType: params.unitType } },
  ],
  headerUI: 'isEnabled',
  uiConfig: (ctx: AbilityReadContext) => {
    const variants = ctx.api.own.getParticipatingVariants({
      excludeSubtypes: ['Evelyn'],
      combatMode: 'GROUND',
    })

    return [
      {
        key: 'unitType' as const,
        label: 'Unit Type',
        type: 'select' as const,
        items: variants.reverse().map(id => ({
          label: getVariantDisplayName(id),
          value: id,
        })),
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
        ctx.api.own.addSubtype(params.unitType, 'Evelyn')
        ctx.api.own.updateAbilityConfig({ isEnabled: false })
      },
    },
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (_params: Params, ctx: AbilityReadContext) => {
        const allUnits = ctx.api.own.getUnits()
        for (const units of Object.values(allUnits)) {
          if (units?.some(u => u.subtypes?.includes('Evelyn'))) return true
        }
        return false
      },
      call: (ctx, params: Params, dice) => {
        const variantId = makeVariantId(params.unitType, ['Evelyn'])
        const unit = ctx.api.own.findUnitByPriority([variantId])
        if (!unit) return
        dice.own.addDice(1, unit)
        ctx.api.own.removeSubtype(variantId, 'Evelyn')
      },
    },
  ],
}
