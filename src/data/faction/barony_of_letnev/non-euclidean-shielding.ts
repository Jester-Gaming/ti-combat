import type { Ability } from '../../../combat/abilities/types'

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
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.own.updateAbilityConfig('SUSTAIN_DAMAGE', {
          hitPerSustain: 2,
        })
      },
    },
  ],
}
