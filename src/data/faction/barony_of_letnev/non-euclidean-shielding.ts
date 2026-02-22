import type { Ability } from '../../../combat/abilities-engine/types'

export const nonEuclideanShielding: Ability = {
  key: 'NON_EUCLIDEAN_SHIELDING',
  name: 'Non-Euclidean Shielding',
  category: 'FACTION',
  subcategory: 'TECHNOLOGY',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'WHEN_SUSTAIN_DAMAGE_USE',
      side: 'OWN',
      call: ctx => {
        ctx.api.own.reduceHits(1)
      },
    },
  ],
}
