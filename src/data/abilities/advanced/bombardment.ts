import type { Ability } from '../../../combat/abilities-engine/types'

type Params = { resolve: boolean }

declare global {
  interface AbilityConfigMap {
    RESOLVE_BOMBARDMENT: Params
  }
}

export const bombardment: Ability<Params> = {
  key: 'RESOLVE_BOMBARDMENT',
  name: 'Bombardment',
  description: 'Bombardment is resolved only when enabled',
  context: 'GROUND',
  params: {
    isEnabled: true,
    uses: Infinity,
    resolve: true,
  },
  side: 'attacker',
  headerUI: 'resolve',
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: params => !params.resolve,
      call: ctx => {
        ctx.api.own.setUnitAbilityCannotBeUsed(
          'BOMBARDMENT',
          'RESOLVE_BOMBARDMENT',
        )
      },
    },
  ],
}
