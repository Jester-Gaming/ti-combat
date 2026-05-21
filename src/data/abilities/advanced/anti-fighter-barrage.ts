import type { Ability } from '@/combat'
import type { CombatSide } from '@/types'

declare global {
  interface AbilityConfigMap {
    ANTI_FIGHTER_BARRAGE: Record<string, never>
  }
}

export const antiFighterBarrage: Ability = {
  key: 'ANTI_FIGHTER_BARRAGE',
  name: 'Anti-Fighter Barrage',
  description: 'AFB is resolved only when enabled',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      // Both sides barrage simultaneously: a single attacker-driven dispatch
      // resolves one combined dice-roll group. `firing` lists only the sides
      // whose AFB is enabled, so a side that opted out simply doesn't roll.
      // The attacker gate guarantees `own` = attacker and `opponent` =
      // defender below.
      timing: 'AFB_STEP',
      isCallable: (_params, ctx) => {
        if (ctx.side === 'attacker') {
          return true
        }

        return !ctx.api.opponent.getAbilityConfig('ANTI_FIGHTER_BARRAGE')
          .isEnabled
      },
      call: ctx => {
        const firing: CombatSide[] = []
        if (ctx.api.own.getAbilityConfig('ANTI_FIGHTER_BARRAGE').isEnabled)
          firing.push('attacker')
        if (ctx.api.opponent.getAbilityConfig('ANTI_FIGHTER_BARRAGE').isEnabled)
          firing.push('defender')
        if (firing.length === 0) return

        ctx.resolveStep('AFB', {
          firing,
        })
      },
    },
  ],
}
