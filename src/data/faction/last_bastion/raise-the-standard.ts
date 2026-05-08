import { z } from 'zod/mini'

import lastBastionIcon from '@/assets/faction/last_bastion.svg?raw'
import { type Ability, declareParam, parseVariantId } from '@/combat'
import {
  GALVANIZED,
  galvanizeUnit,
} from '@/data/abilities/general/pre-galvanized'
import type { UnitList, UnitType } from '@/types'
import { UnitListSchema } from '@/types'

type Params = {
  spaceUnitPriority: UnitList
  groundUnitPriority: UnitList
}

export const raiseTheStandard: Ability<Params> = {
  key: 'RAISE_THE_STANDARD',
  name: 'Raise the Standard',
  description:
    'At the end of a combat: Galvanize 1 of your units that participated. Then, return this card to the Last Bastion player.',
  icon: lastBastionIcon,
  paramsSchema: z.object({
    spaceUnitPriority: UnitListSchema,
    groundUnitPriority: UnitListSchema,
  }),
  params: {
    isEnabled: false,
    uses: 1,
    spaceUnitPriority: declareParam({
      default: [] as UnitList,
      source: 'spaceCombatParticipating',
      sort: 'price-desc',
      filter: v => !parseVariantId(v as UnitType).subtypes.includes(GALVANIZED),
    }),
    groundUnitPriority: declareParam({
      default: [] as UnitList,
      source: 'groundCombatParticipating',
      sort: 'price-desc',
      filter: v => !parseVariantId(v as UnitType).subtypes.includes(GALVANIZED),
    }),
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => {
    const isGround = ctx.state.combatMode === 'GROUND'
    const key = isGround
      ? ('groundUnitPriority' as const)
      : ('spaceUnitPriority' as const)
    return [
      {
        key,
        label: 'Unit Priority',
        type: 'unit-list',
        mode: 'order',
        items: ctx.api.own.getUnitVariantsOptions({
          excludeSubtypes: [GALVANIZED],
          combatMode: ctx.state.combatMode,
        }),
      },
    ]
  },
  invoke: [
    {
      timing: 'END_OF_COMBAT',
      isCallable: (params, ctx) => {
        const priority =
          ctx.state.combatMode === 'GROUND'
            ? params.groundUnitPriority
            : params.spaceUnitPriority
        if (findTarget(ctx.api.own, priority) === undefined) return false
        const tokens =
          ctx.api.own.getAbilityConfig('PRE_GALVANIZED')?.reinforcementTokens ??
          0
        return tokens > 0
      },
      call: (ctx, params) => {
        const priority =
          ctx.state.combatMode === 'GROUND'
            ? params.groundUnitPriority
            : params.spaceUnitPriority
        const target = findTarget(ctx.api.own, priority)
        if (target === undefined) return
        galvanizeUnit(ctx, target, true)
      },
    },
  ],
}

function findTarget(
  api: { hasUnitType: (t: UnitType) => boolean },
  priority: UnitList,
): UnitType | undefined {
  for (const [t] of priority) {
    const type = t as UnitType
    if (parseVariantId(type).subtypes.includes(GALVANIZED)) continue
    if (api.hasUnitType(type)) return type
  }
  return undefined
}
