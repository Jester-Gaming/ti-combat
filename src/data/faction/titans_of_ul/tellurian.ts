import type { Ability, AbilityReadContext } from '@/combat/abilities/types'

type Params = {
  isEnabled: boolean
  uses: number
}

export const tellurian: Ability<Params> = {
  key: 'TELLURIAN',
  name: '(Titan) Tellurian',
  category: 'AGENT',
  headerUI: 'isEnabled',
  defaultParams: {
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
      isCallable: (params: Params, ctx: AbilityReadContext) => {
        if (!params.isEnabled || params.uses <= 0) return false
        return ctx.api.own.getPendingHits() > 0
      },
      call: (ctx, params: Params) => {
        // Cancel 1 hit
        ctx.api.own.reduceHits(1)

        // Decrement uses
        ctx.api.own.updateAbilityConfig({ uses: params.uses - 1 })
      },
    },
  ],
}
