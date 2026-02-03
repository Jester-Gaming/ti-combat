import type { Ability } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const heavensEye: Ability<Params> = {
  key: 'HEAVENS_EYE',
  name: "(Firmament) Heaven's Eye",
  category: 'FACTION',
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'END_OF_COMBAT_ROUND',
      isCallable: (params: Params) => params.isEnabled,
      call: ctx => {
        ctx.api.own.modifyUnit(ctx.getUnit(), { isDamaged: false })
      },
    },
  ],
}
