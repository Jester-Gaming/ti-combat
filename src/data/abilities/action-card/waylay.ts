import type { UnitBaseType } from '@/types'

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
        const settings = ctx.api.opponent.getAbilityConfig('SETTINGS')
        const ships = (settings?.ships as UnitBaseType[]) ?? []
        ctx.api.opponent.updateAbilityConfig('SETTINGS', {
          validTargetsAntiFighterBarrage: [...ships],
        })
      },
    },
  ],
}
