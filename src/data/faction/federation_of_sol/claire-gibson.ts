import type { Ability } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const claireGibson: Ability<Params> = {
  key: 'CLAIRE_GIBSON',
  name: '(Sol) Claire Gibson',
  category: 'COMMANDER',
  context: 'GROUND',
  condition: { onlyDefender: true },
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      context: 'GROUND_COMBAT',
      isCallable: (params: Params) => params.isEnabled,
      call: ctx => {
        ctx.api.own.addUnit({ INFANTRY: 1 })
      },
    },
  ],
}
