import { z } from 'zod/mini'

import type {
  Ability,
  AbilityCallContext,
} from '../../../combat/abilities-engine/types'

type Params = {
  target: 'own' | 'opponent'
}

function applyFlip(ctx: AbilityCallContext, params: Params): void {
  if (params.target === 'own') {
    ctx.api.own.applyConditionalBonusToResult({
      unit: 'ALL_OWN',
      amount: 1,
    })
  } else {
    ctx.api.own.applyConditionalBonusToResult({
      unit: 'ALL_OPPONENT',
      amount: -1,
    })
  }
}

export const heartOfIxth: Ability<Params> = {
  key: 'HEART_OF_IXTH',
  name: 'Heart of Ixth',
  description:
    'After any die is rolled, you may exhaust this card to add or subtract 1 from its result.',
  paramsSchema: z.object({
    target: z.union([z.literal('own'), z.literal('opponent')]),
  }),
  params: {
    isEnabled: false,
    uses: 1,
    target: 'own',
  },
  headerUI: 'isEnabled',
  uiConfig: [
    {
      key: 'target',
      label: 'Target',
      type: 'select',
      items: [
        { label: 'Own (+1)', value: 'own' },
        { label: 'Opponent (-1)', value: 'opponent' },
      ],
    },
  ],
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      system: true,
      isCallable: params => params.isEnabled && params.uses > 0,
      call: applyFlip,
    },
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      system: true,
      isCallable: params => params.isEnabled && params.uses > 0,
      call: applyFlip,
    },
  ],
}
