import type { Ability } from '../../../combat/abilities-engine/types'

export const directHit: Ability = {
  key: 'DIRECT_HIT',
  name: 'Direct Hit',
  category: 'ACTION_CARD',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: 0,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'AFTER_SUSTAIN_DAMAGE_USE',
      side: 'OPPONENT',
      isCallable: (_params, ctx, unitId) => {
        if (!ctx.api.opponent.hasUnit(unitId)) return false
        const { ships } = ctx.api.opponent.getAbilityConfig('SETTINGS')
        const type = ctx.api.opponent.getUnitBaseType(unitId)!
        if (!ships.includes(type)) return false
        const stats = ctx.api.opponent.getUnitStats(unitId)!
        if (stats.DIRECT_HIT_IMMUNE) return false
        return true
      },
      call: (ctx, _params, unitId) => {
        ctx.api.opponent.destroyUnit(unitId)
      },
    },
  ],
}
