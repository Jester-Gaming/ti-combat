import type { Ability } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const twoRam: Ability<Params> = {
  key: 'TWO_RAM',
  name: '(L1z1x) 2RAM',
  category: 'COMMANDER',
  context: 'GROUND',
  condition: {
    onlyAttacker: true,
  },
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: (params: Params) => params.isEnabled,
      call: ctx => {
        ctx.api.opponent.setUnitAbilityLost('PLANETARY_SHIELD', 'TWO_RAM')
      },
    },
  ],
}
