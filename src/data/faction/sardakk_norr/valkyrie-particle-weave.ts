import type { Ability } from '@/combat/abilities/types'

export const valkyrieParticleWeave: Ability = {
  key: 'VALKYRIE_PARTICLE_WEAVE',
  name: 'Valkyrie Particle Weave',
  category: 'FACTION',
  subcategory: 'TECHNOLOGY',
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'AFTER_DICE_ROLL',
      context: 'GROUND_COMBAT',
      isCallable: (_params, ctx) => {
        return ctx.api.own.getPendingHits() >= 1
      },
      call: ctx => {
        ctx.api.opponent.addHits(1, [])
      },
    },
  ],
}
