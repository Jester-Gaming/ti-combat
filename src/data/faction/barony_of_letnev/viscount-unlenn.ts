import { z } from 'zod/mini'

import baronyOfLetnevIcon from '@/assets/faction/barony_of_letnev.svg?raw'
import { type Ability, declareParam, makeVariantId } from '@/combat'
import type { DiceGroup, UnitType, UnitVariantId } from '@/types'

type Params = {
  unitType: UnitType
}

const VISCOUNT = 'Viscount' as UnitVariantId

export const viscountUnlenn: Ability<Params> = {
  key: 'VISCOUNT_UNLENN',
  name: 'Viscount Unlenn',
  description:
    'At the start of a space combat round: You may exhaust this card to choose 1 ship in the active system; that ship rolls 1 additional die during this combat round.',
  icon: baronyOfLetnevIcon,
  context: 'SPACE',
  paramsSchema: z.object({ unitType: z.string() }),
  params: {
    isEnabled: false,
    uses: 1,
    unitType: declareParam<UnitType>({
      default: 'FIGHTER',
      source: 'ships',
    }),
  },
  declareSubtype: params => [
    {
      name: VISCOUNT,
      unitType: params.unitType,
      participating: true,
      statsFactory: parentStats => {
        if (!parentStats.COMBAT) return parentStats
        const [hit, dice, bonus = 0] = parentStats.COMBAT
        return { ...parentStats, COMBAT: [hit, dice, bonus + 1] as DiceGroup }
      },
    },
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
            excludeSubtypeSource: [ctx.this.key],
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
        return ctx.api.own.hasUnitType(params.unitType, {
          includeVariants: false,
        })
      },
      call: (ctx, params) => {
        const [unitId] = ctx.api.own.getUnits(params.unitType, {
          includeVariants: false,
        })
        if (unitId !== undefined) ctx.api.own.addSubtype(unitId, VISCOUNT)
      },
    },
    {
      timing: 'CLEANUP_ROUND',
      system: true,
      isCallable: (params, ctx) => {
        const variantId = makeVariantId(params.unitType, [VISCOUNT])
        return (
          ctx.api.own.getUnits(variantId, { includeVariants: true }).length > 0
        )
      },
      call: (ctx, params) => {
        const variantId = makeVariantId(params.unitType, [VISCOUNT])
        const [unitId] = ctx.api.own.getUnits(variantId, {
          includeVariants: true,
        })
        if (unitId !== undefined) ctx.api.own.removeSubtype(unitId, VISCOUNT)
      },
    },
  ],
}
