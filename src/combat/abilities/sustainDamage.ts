import type { Ability, AbilityContext } from './types'

export const sustainDamage: Ability = {
  name: 'SUSTAIN_DAMAGE',
  params: {
    HIT_PER_SUSTAIN: 1,
  },
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      isCallable: (ctx: AbilityContext) => {
        const hasHits = ctx.my.pendingHits > 0
        const hasUndamagedDreadnought = ctx.my.units.DREADNOUGHT?.some(
          unit => !unit.isDamaged,
        )
        return hasHits && !!hasUndamagedDreadnought
      },
      call: (ctx: AbilityContext, params: Record<string, unknown>) => {
        const hitPerSustain = (params.HIT_PER_SUSTAIN as number) ?? 1
        const availableDreadnought = ctx.my.units.DREADNOUGHT?.find(
          unit => !unit.isDamaged,
        )

        if (availableDreadnought) {
          availableDreadnought.isDamaged = true
          ctx.my.reduceHits(hitPerSustain)
          ctx.state.triggerEvent('SUSTAIN_DAMAGE', availableDreadnought)
        }
      },
    },
  ],
}
