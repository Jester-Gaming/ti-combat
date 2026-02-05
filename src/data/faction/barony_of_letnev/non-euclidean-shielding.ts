import type { Ability } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const nonEuclideanShielding: Ability<Params> = {
  key: 'NON_EUCLIDEAN_SHIELDING',
  name: 'Non-Euclidean Shielding',
  category: 'FACTION',
  subcategory: 'TECHNOLOGY',
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: (params: Params) => params.isEnabled,
      call: ctx => {
        ctx.api.own.updateAbilityConfig('SUSTAIN_DAMAGE', {
          hitPerSustain: 2,
        })
      },
    },
  ],
}
