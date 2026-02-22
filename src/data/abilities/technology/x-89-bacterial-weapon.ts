import type { Ability } from '../../../combat/abilities-engine/types'

export const x89BacterialWeapon: Ability = {
  key: 'X_89_BACTERIAL_WEAPON',
  name: 'X-89 Bacterial Weapon',
  category: 'TECHNOLOGY',
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'AFTER_UNIT_ABILITY_ROLL',
      context: 'BOMBARDMENT',
      isCallable: (_params, ctx) => {
        return ctx.api.opponent.getPendingHits() >= 1
      },
      call: ctx => {
        const pending = ctx.api.opponent.getPendingHits()
        ctx.api.opponent.addHits(pending, [])
      },
    },
    {
      timing: 'AFTER_DICE_ROLL',
      context: 'GROUND_COMBAT',
      isCallable: (_params, ctx) => {
        return ctx.api.opponent.getPendingHits() >= 1
      },
      call: ctx => {
        const pending = ctx.api.opponent.getPendingHits()
        ctx.api.opponent.addHits(pending, [])
      },
    },
  ],
}
