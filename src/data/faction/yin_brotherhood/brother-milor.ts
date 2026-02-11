import yinBrotherhoodIcon from '@/assets/faction/yin_brotherhood.svg?raw'
import type { Ability } from '@/combat/abilities/types'

export const brotherMilor: Ability = {
  key: 'BROTHER_MILOR',
  name: 'Brother Milor',
  icon: yinBrotherhoodIcon,
  category: 'AGENT',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'AFTER_DESTROY',
      isCallable: (_params, _ctx, units) => {
        return units.own.length > 0
      },
      call: ctx => {
        if (ctx.state.combatMode === 'SPACE') {
          ctx.api.own.addUnit({ FIGHTER: 2 })
        } else {
          ctx.api.own.addUnit({ INFANTRY: 2 })
        }
      },
    },
  ],
}
