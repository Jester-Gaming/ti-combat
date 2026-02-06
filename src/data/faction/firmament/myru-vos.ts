import type { Ability } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const myruVos: Ability<Params> = {
  key: 'MYRU_VOS',
  name: '(Firmament) Myru Vos',
  category: 'AGENT',
  context: 'SPACE',
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: (params: Params) => params.isEnabled,
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed('SPACE_CANNON', 'MYRU_VOS')
      },
    },
  ],
}
