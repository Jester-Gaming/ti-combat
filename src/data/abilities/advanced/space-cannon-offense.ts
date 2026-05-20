import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { UnitList } from '@/types'
import { UnitListSchema } from '@/types'

type Params = {
  customScoPriority: boolean
  scoUnitPriority: UnitList
}

declare global {
  interface AbilityConfigMap {
    SPACE_CANNON_OFFENSE: Params
  }
}

export const spaceCannonOffense: Ability<Params> = {
  key: 'SPACE_CANNON_OFFENSE',
  name: 'Space Cannon Offense',
  description: 'Space Cannon Offense is resolved only when enabled',
  context: 'SPACE',
  paramsSchema: z.object({
    customScoPriority: z.boolean(),
    scoUnitPriority: UnitListSchema,
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    customScoPriority: false,
    scoUnitPriority: declareParam<UnitList>({
      default: [],
      source: 'spaceCombatParticipating',
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'SPACE_CANNON_OFFENSE_STEP',
      call: ctx =>
        ctx.resolveStep('SPACE_CANNON_OFFENSE', {
          deferCompletionCheck: true,
        }),
    },
  ],
  uiConfig: (ctx, params) => {
    if (ctx.state.combatMode !== 'SPACE') return []
    return [
      {
        key: 'customScoPriority',
        label: 'Custom priority for SCO',
        type: 'checkbox',
      },
      {
        key: 'scoUnitPriority',
        label: 'Space Cannon Offense Priority',
        type: 'unit-list',
        mode: 'order',
        items: ctx.api.own.getUnitVariantsOptions('scoUnitPriority'),
        visible: params.customScoPriority,
      },
    ]
  },
}
