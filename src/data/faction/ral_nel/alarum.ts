import type { Ability } from '../../../combat/abilities/types'

type Params = {
  infantryAvailable: number
}

export const alarum: Ability<Params> = {
  key: 'ALARUM',
  name: 'Alarum',
  category: 'FACTION',
  subcategory: 'MECH',
  params: {
    isEnabled: true,
    uses: Infinity,
    infantryAvailable: 0,
  },
  headerUI: 'infantryAvailable',
  invoke: [
    {
      timing: 'END_OF_COMBAT_ROUND',
      context: 'GROUND_COMBAT',
      isCallable: params => params.infantryAvailable > 0,
      call: (ctx, params) => {
        const count = Math.min(2, params.infantryAvailable)
        ctx.api.own.addUnit({ INFANTRY: count })
        ctx.api.own.updateAbilityConfig({
          infantryAvailable: params.infantryAvailable - count,
        })
        ctx.log(`Moved ${count} infantry from adjacent systems`)
      },
    },
  ],
}
