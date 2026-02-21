import federationOfSolIcon from '@/assets/faction/federation_of_sol.svg?raw'
import { declareParam } from '@/combat/abilities/declare-param'
import { getUnitId } from '@/combat/utils/compact-units'
import { makeVariantId, parseVariantId } from '@/combat/utils/unit-variant'
import type { UnitBaseType } from '@/types'

import type { Ability } from '../../../combat/abilities/types'

type Params = {
  unitType: UnitBaseType
}

export const evelynDelouis: Ability<Params> = {
  key: 'EVELYN_DELOUIS',
  name: 'Evelyn DeLouis',
  icon: federationOfSolIcon,
  category: 'AGENT',
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: 2,
    unitType: declareParam<UnitBaseType>({
      default: 'INFANTRY',
      source: 'groundForces',
    }),
  },
  declareParamChange: params => [
    { key: 'subtypes', value: { name: 'Evelyn', unitType: params.unitType } },
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
            excludeSubtypes: ['Evelyn'],
            combatMode: 'GROUND',
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
        ctx.api.own.addSubtype(params.unitType, 'Evelyn')
      },
    },
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (_params, ctx) => {
        const allUnits = ctx.api.own.getUnits()
        for (const units of Object.values(allUnits)) {
          if (units?.some(u => u.subtypes?.includes('Evelyn'))) return true
        }
        return false
      },
      call: (ctx, params, dice) => {
        const variantId = makeVariantId(params.unitType, ['Evelyn'])
        const unit = ctx.api.own.findUnitByPriority([variantId])
        if (!unit) return
        dice.own.addDiceCount(1, getUnitId(unit)!)
        ctx.api.own.removeSubtype(variantId, 'Evelyn')
      },
    },
  ],
}
