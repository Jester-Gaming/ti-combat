import type { Ability } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const waylay: Ability<Params> = {
  key: 'WAYLAY',
  name: 'Waylay',
  category: 'ACTION_CARD',
  context: 'SPACE',
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'AFB',
      isCallable: (params: Params) => params.isEnabled,
      call: ctx => {
        ctx.api.opponent.updateAbilityConfig('SETTINGS', {
          validTargetsAntiFighterBarrage: [],
        })
      },
    },
  ],
}
