import { z } from 'zod/mini'

import type { UnitList } from '@/types'
import { UnitListSchema } from '@/types'

import { declareParam } from '../../../combat/abilities-engine/declare-param'
import type { Ability } from '../../../combat/abilities-engine/types'

type Params = {
  resolve: boolean
  customScoPriority: boolean
  scoUnitPriority: UnitList
}

declare global {
  interface AbilityConfigMap {
    RESOLVE_SPACE_CANNON: Params
  }
}

export const spaceCannon: Ability<Params> = {
  key: 'RESOLVE_SPACE_CANNON',
  name: 'Space Cannon',
  description: 'Space Cannon is resolved only when enabled',
  paramsSchema: z.object({
    resolve: z.boolean(),
    customScoPriority: z.boolean(),
    scoUnitPriority: UnitListSchema,
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    resolve: true,
    customScoPriority: false,
    scoUnitPriority: declareParam<UnitList>({
      default: [],
      source: 'spaceCombatParticipating',
    }),
  },
  headerUI: 'resolve',
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: params => !params.resolve,
      call: ctx => {
        ctx.api.own.setUnitAbilityCannotBeUsed(
          'SPACE_CANNON',
          'RESOLVE_SPACE_CANNON',
        )
      },
    },
  ],
  uiConfig: (ctx, params) => {
    if (ctx.state.combatMode !== 'SPACE') return []
    return [
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
              items: ctx.api.own.getUnitVariantsOptions('scoUnitPriority'),
            },
          ]
        : []),
    ]
  },
}
