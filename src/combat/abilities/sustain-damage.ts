import type { Ability, AbilityContext } from './types'

type Params = {
  HIT_PER_SUSTAIN: number
}

export const sustainDamage: Ability<Params> = {
  key: 'SUSTAIN_DAMAGE',
  name: 'Sustain Damage',
  category: 'COMMON',
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
      call: (ctx: AbilityContext, params: Params) => {
        const hitPerSustain = params.HIT_PER_SUSTAIN ?? 1
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
