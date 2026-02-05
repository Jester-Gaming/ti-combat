import type { Ability } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const arcSecundus: Ability<Params> = {
  key: 'ARC_SECUNDUS',
  name: 'Arc Secundus',
  category: 'FACTION',
  subcategory: 'UNIT',
  params: {
    isEnabled: true,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityLost('PLANETARY_SHIELD', 'ARC_SECUNDUS')
      },
    },
    {
      timing: 'START_OF_COMBAT_ROUND',
      call: ctx => {
        ctx.api.own.modifyUnit(ctx.getUnit(), {
          isDamaged: false,
        })
      },
    },
  ],
}
