import type { CombatSide } from '@/types'

import type { Ability } from '../../../combat/abilities-engine/types'

type Params = { resolve: boolean }

declare global {
  interface AbilityConfigMap {
    ANTI_FIGHTER_BARRAGE: Params
  }
}

export const antiFighterBarrage: Ability<Params> = {
  key: 'ANTI_FIGHTER_BARRAGE',
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
      // Both sides barrage simultaneously: a single attacker-driven dispatch
      // resolves one combined dice-roll group. `firing` lists only the sides
      // whose AFB is enabled, so a side that opted out simply doesn't roll.
      // The attacker gate guarantees `own` = attacker and `opponent` =
      // defender below.
      timing: 'AFB_STEP',
      isCallable: (_params, ctx) => ctx.side === 'attacker',
      call: ctx => {
        const firing: CombatSide[] = []
        if (ctx.api.own.getAbilityConfig('ANTI_FIGHTER_BARRAGE').resolve)
          firing.push('attacker')
        if (ctx.api.opponent.getAbilityConfig('ANTI_FIGHTER_BARRAGE').resolve)
          firing.push('defender')
        if (firing.length === 0) return
        ctx.resolveStep('AFB', {
          firing,
        })
      },
    },
  ],
}
