import { z } from 'zod/mini'

import type { Ability } from '../../../combat/abilities-engine/types'

type Params = {
  strategy: 'BEST' | 'WORST'
}

export const plasmaScoring: Ability<Params> = {
  key: 'PLASMA_SCORING',
  name: 'Plasma Scoring',
  category: 'TECHNOLOGY',
  paramsSchema: z.object({
    strategy: z.string(),
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    strategy: 'BEST',
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: ['BOMBARDMENT', 'SPACE_CANNON_OFFENSE', 'SPACE_CANNON_DEFENSE'],
      isCallable: (_params, _ctx, dice) => {
        return !dice.own.isEmpty()
      },
      call: (_ctx, params, dice) => {
        dice.own.addDiceCount(1, params.strategy)
      },
    },
  ],
}
