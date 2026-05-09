import { z } from 'zod/mini'

import type { UnitList } from '@/types'
import { UnitListSchema } from '@/types'

import { declareParam } from '../../../combat/abilities-engine/declare-param'
import type { Ability } from '../../../combat/abilities-engine/types'

type Params = {
  spaceUnitPriority: UnitList
  groundUnitPriority: UnitList
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
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    spaceUnitPriority: declareParam<UnitList>({
      default: [],
      source: 'spaceCombatParticipating',
      includeNonParticipating: true,
    }),
    groundUnitPriority: declareParam<UnitList>({
      default: [],
      source: 'groundCombatParticipating',
    }),
  },
  invoke: [],
  uiConfig: ctx => {
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

    return [
      {
        key: 'spaceUnitPriority' as const,
        type: 'unit-list' as const,
        mode: 'order' as const,
        items: ctx.api.own.getUnitVariantsOptions(),
      },
    ]
  },
}
