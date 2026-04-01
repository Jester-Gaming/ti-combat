import { z } from 'zod/mini'

import type { Ability } from '../../../combat/abilities-engine/types'

type Params = {
  supportCount: number
}

export const imperator: Ability<Params> = {
  key: 'IMPERATOR',
  name: 'Imperator',
  category: 'FACTION',
  subcategory: 'BREAKTHROUGH',
  paramsSchema: z.object({ supportCount: z.number() }),
  params: {
    isEnabled: true,
    uses: Infinity,
    supportCount: 0,
  },
  headerUI: 'supportCount',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: (ctx, params) => {
        ctx.api.own.modifyHitValue(-params.supportCount)
      },
    },
  ],
}
