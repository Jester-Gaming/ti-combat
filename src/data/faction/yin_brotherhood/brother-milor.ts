import yinBrotherhoodIcon from '@/assets/faction/yin_brotherhood.svg?raw'
import type { Ability } from '@/combat'
import type { UnitType } from '@/types'

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
        for (const key in units.own) {
          if (units.own[key as UnitType]?.length > 0) return true
        }
        return false
      },
      call: ctx => {
        if (ctx.state.combatMode === 'SPACE') {
          ctx.api.own.placeUnits({ FIGHTER: 2 })
        } else {
          ctx.api.own.placeUnits({ INFANTRY: 2 })
        }
      },
    },
  ],
}
