import type { Ability } from '../../../combat/abilities/types'

export const waylay: Ability = {
  key: 'WAYLAY',
  name: 'Waylay',
  category: 'ACTION_CARD',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'AFB',
      call: ctx => {
        ctx.api.opponent.updateAbilityConfig('SETTINGS', {
          validTargetsAntiFighterBarrage: [],
        })
      },
    },
  ],
}
