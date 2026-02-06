import type { Ability } from '@/combat/abilities/types'

export const tellurian: Ability = {
  key: 'TELLURIAN',
  name: '(Titan) Tellurian',
  category: 'AGENT',
  headerUI: 'isEnabled',
  params: {
    isEnabled: false,
    uses: 1,
  },
  uiConfig: [
    {
      type: 'number',
      key: 'uses',
      label: 'Usages',
      min: 0,
    },
  ],
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      isCallable: (_params, ctx) => {
        return ctx.api.own.getPendingHits() > 0
      },
      call: ctx => {
        // Cancel 1 hit
        ctx.api.own.reduceHits(1)
      },
    },
  ],
}
