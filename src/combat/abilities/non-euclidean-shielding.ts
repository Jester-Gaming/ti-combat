import type { Ability, AbilityContext } from './types'

type Params = {
  isEnabled: boolean
}

export const nonEuclideanShielding: Ability<Params> = {
  key: 'NON_EUCLIDEAN_SHIELDING',
  name: 'Non-Euclidean Shielding',
  category: 'FACTION',
  defaultParams: {
    isEnabled: false,
  },
  enableUI: true,
  invoke: [
    {
      timing: 'SETUP',
      isCallable: (ctx: AbilityContext, params: Params) => {
        return params.isEnabled && ctx.abilities.my.has('SUSTAIN_DAMAGE')
      },
      call: (ctx: AbilityContext) => {
        const sustainDamage = ctx.abilities.my.get('SUSTAIN_DAMAGE')
        if (sustainDamage) {
          sustainDamage.modifyParams({
            hitPerSustain: 2,
          })
        }
      },
    },
  ],
}
