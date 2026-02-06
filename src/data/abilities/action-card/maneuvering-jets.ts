import type { Ability } from '../../../combat/abilities/types'

export const maneuveringJets: Ability = {
  key: 'MANEUVERING_JETS',
  name: 'Maneuvering Jets',
  category: 'ACTION_CARD',
  params: {
    isEnabled: true,
    uses: 0,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      context: ['SPACE_CANNON_OFFENSE', 'SPACE_CANNON_DEFENSE'],
      isCallable: (_params, ctx) => {
        return ctx.api.own.getPendingHits() > 0
      },
      call: ctx => {
        ctx.api.own.reduceHits(1)
      },
    },
  ],
}
