import type { Ability } from '../../../combat/abilities-engine/types'

export const shieldsHolding: Ability = {
  key: 'SHIELDS_HOLDING',
  name: 'Shields Holding',
  category: 'ACTION_CARD',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: 0,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      context: ['SPACE_COMBAT', 'AFB'],
      isCallable: (_params, ctx) => {
        return ctx.api.own.getPendingHits() > 0
      },
      call: ctx => {
        const pending = ctx.api.own.getPendingHits()
        ctx.api.own.reduceHits(Math.min(2, pending))
      },
    },
  ],
}
