import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { UnitType } from '@/types'

type Params = {
  targets: UnitType[]
}

export const directHit: Ability<Params> = {
  key: 'DIRECT_HIT',
  name: 'Direct Hit',
  description:
    "After another player's ship uses Sustain Damage to cancel a hit produced by your units or abilities: Destroy that ship.",
  context: 'SPACE',
  paramsSchema: z.object({ targets: z.array(z.string()) }),
  params: {
    isEnabled: true,
    uses: 0,
    targets: declareParam({
      default: [],
      source: 'ships',
      side: 'opponent',
    }),
  },
  headerUI: 'uses',
  uiConfig: ctx => [
    {
      key: 'targets' as const,
      type: 'checkbox-list' as const,
      items: ctx.api.opponent.getUnitVariantsOptions({ combatMode: 'SPACE' }),
    },
  ],
  invoke: [
    {
      timing: 'AFTER_SUSTAIN_DAMAGE_USE',
      isCallable: (params, ctx, unitId) => {
        if (!ctx.api.opponent.hasUnit(unitId)) return false
        const variant = ctx.api.opponent.getVariantKey(unitId)
        if (!variant) return false
        if (!params.targets.includes(variant as UnitType)) return false
        const stats = ctx.api.opponent.getUnitStats(unitId)!
        if (stats.DIRECT_HIT_IMMUNE) return false
        return true
      },
      call: (ctx, _params, unitId) => {
        ctx.api.opponent.destroyUnits(unitId)
      },
    },
  ],
}
