import { z } from 'zod/mini'

import type { UnitType } from '@/types'

import { declareParam } from '../../../combat/abilities-engine/declare-param'
import type { Ability } from '../../../combat/abilities-engine/types'

type Params = {
  spaceUnitPriority: UnitType[]
  groundUnitPriority: UnitType[]
  customScoPriority: boolean
  scoUnitPriority: UnitType[]
}

declare global {
  interface AbilityConfigMap {
    UNIT_PRIORITY: Params
  }
}

export const unitPriority: Ability<Params> = {
  key: 'UNIT_PRIORITY',
  name: 'Assign Hits Order',
  paramsSchema: z.object({
    spaceUnitPriority: z.array(z.string()),
    groundUnitPriority: z.array(z.string()),
    customScoPriority: z.boolean(),
    scoUnitPriority: z.array(z.string()),
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    spaceUnitPriority: declareParam({
      default: [],
      source: 'spaceCombatParticipating',
    }),
    groundUnitPriority: declareParam({
      default: [],
      source: 'groundCombatParticipating',
    }),
    customScoPriority: false,
    scoUnitPriority: declareParam({
      default: [],
      source: 'spaceCombatParticipating',
    }),
  },
  onParamSet(params, key) {
    if (key === 'spaceUnitPriority' && !params.customScoPriority) {
      params.scoUnitPriority = params.spaceUnitPriority
      return params
    }
  },
  invoke: [],
  uiConfig: (ctx, params) => {
    if (ctx.state.combatMode === 'GROUND') {
      return [
        {
          key: 'groundUnitPriority' as const,
          type: 'order-list' as const,
          items: ctx.api.own.getUnitVariantsOptions(),
        },
      ]
    }

    const unitItems = ctx.api.own.getUnitVariantsOptions()

    return [
      {
        key: 'spaceUnitPriority' as const,
        type: 'order-list' as const,
        items: unitItems,
      },
      {
        key: 'customScoPriority' as const,
        label: 'Custom priority for SCO',
        type: 'checkbox' as const,
      },
      ...(params.customScoPriority
        ? [
            {
              key: 'scoUnitPriority' as const,
              label: 'Space Cannon Offense Priority',
              type: 'order-list' as const,
              items: unitItems,
            },
          ]
        : []),
    ]
  },
}
