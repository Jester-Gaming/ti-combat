import federationOfSolIcon from '@/assets/faction/federation_of_sol.svg?raw'
import { type Ability, declareParam, makeVariantId } from '@/combat'
import type { UnitType, UnitVariantId } from '@/types'

type Params = {
  unitType: UnitType
}

const EVELYN = 'Evelyn' as UnitVariantId

export const evelynDelouis: Ability<Params> = {
  key: 'EVELYN_DELOUIS',
  name: 'Evelyn DeLouis',
  icon: federationOfSolIcon,
  category: 'AGENT',
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: 2,
    unitType: declareParam<UnitType>({
      default: 'INFANTRY',
      source: 'groundForces',
    }),
  },
  declareParamChange: params => [
    { key: 'subtypes', value: { name: EVELYN, unitType: params.unitType } },
  ],
  headerUI: 'isEnabled',
  uiConfig: ctx => {
    return [
      {
        key: 'unitType',
        label: 'Unit Type',
        type: 'select',
        items: ctx.api.own
          .getUnitVariantsOptions({
            excludeSubtypes: [EVELYN],
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
        return ctx.api.own.hasUnitType(params.unitType)
      },
      call: (ctx, params) => {
        ctx.api.own.addSubtype(params.unitType, EVELYN)
      },
    },
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (params, ctx) => {
        const variantId = makeVariantId(params.unitType, [EVELYN])
        const unitId = ctx.api.own.findUnitByPriority([variantId])
        return !!unitId
      },
      call: (ctx, params, dice) => {
        const variantId = makeVariantId(params.unitType, [EVELYN])
        const unitId = ctx.api.own.findUnitByPriority([variantId])
        if (unitId === undefined) return
        dice.own.addDiceCount(1, unitId)
        ctx.api.own.removeSubtype(variantId, EVELYN)
      },
    },
  ],
}
