import type {
  Ability,
  AbilityReadContext,
  StateChange,
} from '@/combat/abilities/types'
import { getPendingHits, reduceHits } from '@/combat/state/side-state-ops'

type Params = {
  isEnabled: boolean
  uses: number
}

export const tellurian: Ability<Params> = {
  key: 'TELLURIAN',
  name: '(Titan) Tellurian',
  category: 'AGENT',
  enableUI: true,
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
      isCallable: (ctx: AbilityReadContext, params: Params) => {
        if (!params.isEnabled || params.uses <= 0) return false
        return getPendingHits(ctx.own) > 0
      },
      call: (ctx: AbilityReadContext, params: Params): StateChange<void> => {
        // Cancel 1 hit
        let newState = reduceHits(ctx.state, ctx.side, 1)

        // Decrement uses by updating config in state
        const sideAbilities = newState.abilities[ctx.side]
        newState = {
          ...newState,
          abilities: {
            ...newState.abilities,
            [ctx.side]: {
              ...sideAbilities,
              config: {
                ...sideAbilities.config,
                TELLURIAN: {
                  ...sideAbilities.config?.TELLURIAN,
                  uses: params.uses - 1,
                },
              },
            },
          },
        }

        return { state: newState }
      },
    },
  ],
}
