import type { Ability } from '@/combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const brotherMilor: Ability<Params> = {
  key: 'BROTHER_MILOR',
  name: '(Yin) Brother Milor',
  category: 'AGENT',
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'AFTER_DESTROY',
      isCallable: (params, _ctx, units) => {
        if (!params.isEnabled) return false
        return units.own.length > 0
      },
      call: ctx => {
        if (ctx.state.combatMode === 'SPACE') {
          ctx.api.own.addUnit({ FIGHTER: 2 })
        } else {
          ctx.api.own.addUnit({ INFANTRY: 2 })
        }
        ctx.api.own.updateAbilityConfig({ isEnabled: false })
      },
    },
  ],
}
