import type { Ability } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const reflectiveShielding: Ability<Params> = {
  key: 'REFLECTIVE_SHIELDING',
  name: 'Reflective Shielding',
  category: 'ACTION_CARD',
  context: 'SPACE',
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'WHEN_SUSTAIN_DAMAGE_USE',
      side: 'OWN',
      isCallable: (params: Params) => {
        return params.isEnabled
      },
      call: ctx => {
        ctx.api.opponent.addHits(2, [])
        ctx.api.own.updateAbilityConfig({ isEnabled: false })
      },
    },
  ],
}
