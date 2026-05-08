import type { Ability } from '../../../combat/abilities-engine/types'

type Params = { resolve: boolean }

declare global {
  interface AbilityConfigMap {
    RESOLVE_ANTI_FIGHTER_BARRAGE: Params
  }
}

export const antiFighterBarrage: Ability<Params> = {
  key: 'RESOLVE_ANTI_FIGHTER_BARRAGE',
  name: 'Anti-Fighter Barrage',
  description: 'AFB is resolved only when enabled',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
    resolve: true,
  },
  headerUI: 'resolve',
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: params => !params.resolve,
      call: ctx => {
        ctx.api.own.setUnitAbilityCannotBeUsed(
          'AFB',
          'RESOLVE_ANTI_FIGHTER_BARRAGE',
        )
      },
    },
  ],
}
