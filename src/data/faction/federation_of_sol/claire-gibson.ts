import type { Ability } from '../../../combat/abilities/types'

export const claireGibson: Ability = {
  key: 'CLAIRE_GIBSON',
  name: '(Sol) Claire Gibson',
  category: 'COMMANDER',
  context: 'GROUND',
  side: 'defender',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      context: 'GROUND_COMBAT',
      call: ctx => {
        ctx.api.own.addUnit({ INFANTRY: 1 })
      },
    },
  ],
}
