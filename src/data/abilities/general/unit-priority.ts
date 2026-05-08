import { z } from 'zod/mini'

import type { UnitList } from '@/types'
import { UnitListSchema } from '@/types'

import { declareParam } from '../../../combat/abilities-engine/declare-param'
import type { Ability } from '../../../combat/abilities-engine/types'

type Params = {
  spaceUnitPriority: UnitList
  groundUnitPriority: UnitList
  customScoPriority: boolean
  scoUnitPriority: UnitList
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
    spaceUnitPriority: UnitListSchema,
    groundUnitPriority: UnitListSchema,
    customScoPriority: z.boolean(),
    scoUnitPriority: UnitListSchema,
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    spaceUnitPriority: declareParam<UnitList>({
      default: [],
      source: 'spaceCombatParticipating',
    }),
    groundUnitPriority: declareParam<UnitList>({
      default: [],
      source: 'groundCombatParticipating',
    }),
    customScoPriority: false,
    scoUnitPriority: declareParam<UnitList>({
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
          type: 'unit-list' as const,
          mode: 'order' as const,
          items: ctx.api.own.getUnitVariantsOptions(),
        },
      ]
    }

    const unitItems = ctx.api.own.getUnitVariantsOptions()

    return [
      {
        key: 'spaceUnitPriority' as const,
        type: 'unit-list' as const,
        mode: 'order' as const,
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
              type: 'unit-list' as const,
              mode: 'order' as const,
              items: unitItems,
            },
          ]
        : []),
    ]
  },
}
