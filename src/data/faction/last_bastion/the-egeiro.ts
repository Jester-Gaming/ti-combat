import { z } from 'zod/mini'

import type { Ability } from '../../../combat/abilities-engine/types'

type Params = {
  nonHomeSystems: number
}

export const theEgeiro: Ability<Params> = {
  key: 'THE_EGEIRO',
  name: 'The Egeiro',
  category: 'FACTION',
  subcategory: 'FLAGSHIP',
  context: 'SPACE',
  paramsSchema: z.object({ nonHomeSystems: z.number() }),
  params: {
    isEnabled: true,
    uses: Infinity,
    nonHomeSystems: 0,
  },
  headerUI: 'nonHomeSystems',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: (ctx, params) => {
        ctx.api.own.modifyHitValue(-params.nonHomeSystems, ctx.getUnit())
      },
    },
  ],
}
