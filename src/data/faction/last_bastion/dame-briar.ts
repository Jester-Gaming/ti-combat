import { z } from 'zod/mini'

import lastBastionIcon from '@/assets/faction/last_bastion.svg?raw'
import { type Ability, declareParam } from '@/combat'
import {
  declareGalvanizeUnits,
  GALVANIZED,
  galvanizeUnit,
} from '@/data/abilities/general/pre-galvanized'
import type { UnitType } from '@/types'

type Params = {
  spaceUnitType: UnitType
  groundUnitType: UnitType
}

export const dameBriar: Ability<Params> = {
  key: 'DAME_BRIAR',
  name: 'Dame Briar',
  description:
    "When a player's unit is destroyed: You may exhaust this card to galvanize another of that player's units in the destroyed unit's system.",
  icon: lastBastionIcon,
  category: 'AGENT',
  paramsSchema: z.object({
    spaceUnitType: z.string(),
    groundUnitType: z.string(),
  }),
  params: {
    isEnabled: false,
    uses: 1,
    spaceUnitType: declareParam<UnitType>({
      default: 'DESTROYER',
      source: 'spaceCombatParticipating',
    }),
    groundUnitType: declareParam<UnitType>({
      default: 'INFANTRY',
      source: 'groundCombatParticipating',
    }),
  },
  headerUI: 'isEnabled',
  declareParamChange: params => [
    declareGalvanizeUnits(params.spaceUnitType),
    declareGalvanizeUnits(params.groundUnitType),
  ],
  uiConfig: ctx => {
    const isGround = ctx.state.combatMode === 'GROUND'
    const key = isGround
      ? ('groundUnitType' as const)
      : ('spaceUnitType' as const)
    return [
      {
        key,
        label: 'Unit Type',
        type: 'select',
        items: ctx.api.own
          .getUnitVariantsOptions({
            excludeSubtypes: [GALVANIZED],
            combatMode: ctx.state.combatMode,
          })
          .reverse(),
      },
    ]
  },
  invoke: [
    {
      timing: 'WHEN_DESTROY',
      isCallable: (params, ctx, ids) => {
        const anyOwnDestroyed = ids.some(id => !!ctx.api.own.getVariantKey(id))
        if (!anyOwnDestroyed) return false
        const target =
          ctx.state.combatMode === 'GROUND'
            ? params.groundUnitType
            : params.spaceUnitType
        if (!ctx.api.own.hasUnitType(target)) return false
        const tokens =
          ctx.api.own.getAbilityConfig('PRE_GALVANIZED')?.reinforcementTokens ??
          0
        return tokens > 0
      },
      call: (ctx, params) => {
        const target =
          ctx.state.combatMode === 'GROUND'
            ? params.groundUnitType
            : params.spaceUnitType
        galvanizeUnit(ctx, target, true)
      },
    },
  ],
}
