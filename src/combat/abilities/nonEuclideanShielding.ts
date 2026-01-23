import type { Ability, AbilityContext } from './types'

export const nonEuclideanShielding: Ability = {
  name: 'NON_EUCLIDEAN_SHIELDING',
  invoke: [
    {
      timing: 'SETUP',
      isCallable: (ctx: AbilityContext) => {
        return ctx.abilities.my.has('SUSTAIN_DAMAGE')
      },
      call: (ctx: AbilityContext) => {
        const sustainDamage = ctx.abilities.my.get('SUSTAIN_DAMAGE')
        if (sustainDamage) {
          sustainDamage.modifyParams({
            HIT_PER_SUSTAIN: 2,
          })
        }
      },
    },
  ],
}
