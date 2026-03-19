import baronyOfLetnevIcon from '@/assets/faction/barony_of_letnev.svg?raw'
import {
  type Ability,
  declareParam,
  makeVariantId,
  parseVariantId,
} from '@/combat'
import type { UnitType, UnitVariantId } from '@/types'

type Params = {
  unitType: UnitType
}

const VISCOUNT = 'Viscount' as UnitVariantId

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
    { key: 'subtypes', value: { name: VISCOUNT, unitType: params.unitType } },
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
            excludeSubtypes: [VISCOUNT],
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
        return ctx.api.own.hasUnitType(type)
      },
      call: (ctx, params) => {
        ctx.api.own.addSubtype(params.unitType, VISCOUNT)
      },
    },
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (params, ctx) => {
        const variantId = makeVariantId(params.unitType, [VISCOUNT])
        const unitId = ctx.api.own.findUnitByPriority([variantId])
        return unitId !== undefined
      },
      call: (ctx, params, dice) => {
        const variantId = makeVariantId(params.unitType, [VISCOUNT])
        const unitId = ctx.api.own.findUnitByPriority([variantId])
        if (unitId === undefined) return
        dice.own.addDiceCount(1, unitId)
        ctx.api.own.removeSubtype(variantId, VISCOUNT)
        return
      },
    },
  ],
}
