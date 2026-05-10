import { type Ability, declareParam } from '@/combat'
import type { UnitList, UnitType } from '@/types'

type Params = {
  targets: UnitList<boolean>
}

export const directHit: Ability<Params> = {
  key: 'DIRECT_HIT',
  name: 'Direct Hit',
  description:
    "After another player's ship uses Sustain Damage to cancel a hit produced by your units or abilities: Destroy that ship.",
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: 0,
    targets: declareParam<UnitList<boolean>>({
      default: [],
      source: 'ships',
      side: 'opponent',
      defaultItemValue: true,
      filter: {
        combatMode: 'SPACE',
      },
    }),
  },
  headerUI: 'uses',
  uiConfig: ctx => [
    {
      key: 'targets' as const,
      type: 'unit-list' as const,
      mode: 'checkbox' as const,
      items: ctx.api.opponent.getUnitVariantsOptions('targets'),
    },
  ],
  invoke: [
    {
      timing: 'AFTER_SUSTAIN_DAMAGE_USE',
      isCallable: (params, ctx, unitId) => {
        if (!ctx.api.opponent.hasUnit(unitId)) return false
        const variant = ctx.api.opponent.getUnitVariantKey(unitId)
        if (!variant) return false
        const targets = ctx.utils.getFlat(params.targets)
        if (!targets.includes(variant as UnitType)) return false
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
