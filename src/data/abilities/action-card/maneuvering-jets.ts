import type {
  Ability,
  AbilityReadContext,
} from '../../../combat/abilities/types'

type Params = {
  uses: number
}

export const maneuveringJets: Ability<Params> = {
  key: 'MANEUVERING_JETS',
  name: 'Maneuvering Jets',
  category: 'ACTION_CARD',
  params: {
    uses: 0,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      context: ['SPACE_CANNON_OFFENSE', 'SPACE_CANNON_DEFENSE'],
      isCallable: (params: Params, ctx: AbilityReadContext) => {
        if (params.uses <= 0) return false
        return ctx.api.own.getPendingHits() > 0
      },
      call: (ctx, params: Params) => {
        ctx.api.own.reduceHits(1)
        ctx.api.own.updateAbilityConfig({ uses: params.uses - 1 })
      },
    },
  ],
}
