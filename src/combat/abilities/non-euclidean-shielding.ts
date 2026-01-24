import type { Ability, AbilityReadContext, StateChange } from './types'

type Params = {
  isEnabled: boolean
  hitPerSustain: number
}

/**
 * Non-Euclidean Shielding - modifies sustain damage behavior.
 * Note: The hitPerSustain param should be configured on SUSTAIN_DAMAGE ability instead.
 */
export const nonEuclideanShielding: Ability<Params> = {
  key: 'NON_EUCLIDEAN_SHIELDING',
  name: 'Non-Euclidean Shielding',
  category: 'FACTION',
  defaultParams: {
    isEnabled: false,
    hitPerSustain: 2,
  },
  enableUI: true,
  invoke: [
    {
      timing: 'SETUP',
      isCallable: (_ctx: AbilityReadContext, params: Params) =>
        params.isEnabled,
      call: (ctx: AbilityReadContext): StateChange<void> => {
        // This ability's effect is now handled via configuration
        // The hitPerSustain value should be passed to SUSTAIN_DAMAGE ability
        return { state: ctx.state }
      },
    },
  ],
}
