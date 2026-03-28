import federationOfSolIcon from '@/assets/faction/federation_of_sol.svg?raw'
import { type Ability, declareParam, makeVariantId } from '@/combat'
import type { DiceGroup, UnitType, UnitVariantId } from '@/types'

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
        ctx.api.own.addSubtype(params.unitType, EVELYN, parentStats => {
          if (!parentStats.COMBAT) return parentStats
          const [hit, dice, bonus = 0] = parentStats.COMBAT
          return { ...parentStats, COMBAT: [hit, dice, bonus + 1] as DiceGroup }
        })
      },
    },
    {
      timing: 'CLEANUP_ROUND',
      isCallable: (params, ctx) => {
        const variantId = makeVariantId(params.unitType, [EVELYN])
        const unitId = ctx.api.own.findUnitByPriority([variantId])
        return unitId !== undefined
      },
      call: (ctx, params) => {
        const variantId = makeVariantId(params.unitType, [EVELYN])
        ctx.api.own.removeSubtype(variantId, EVELYN)
      },
    },
  ],
}
