import type {
  Ability,
  AbilityReadContext,
} from '../../../combat/abilities/types'

type Params = {
  uses: number
}

export const shieldsHolding: Ability<Params> = {
  key: 'SHIELDS_HOLDING',
  name: 'Shields Holding',
  category: 'ACTION_CARD',
  context: 'SPACE',
  params: {
    uses: 0,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      context: 'SPACE_COMBAT',
      isCallable: (params: Params, ctx: AbilityReadContext) => {
        if (params.uses <= 0) return false
        return ctx.api.own.getPendingHits() > 0
      },
      call: (ctx, params: Params) => {
        const pending = ctx.api.own.getPendingHits()
        ctx.api.own.reduceHits(Math.min(2, pending))
        ctx.api.own.updateAbilityConfig({ uses: params.uses - 1 })
      },
    },
  ],
}
