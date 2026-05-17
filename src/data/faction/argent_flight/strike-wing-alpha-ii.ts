import type { Ability } from '../../../combat/abilities-engine/types'

export const strikeWingAlphaII: Ability = {
  key: 'STRIKE_WING_ALPHA_II',
  name: 'Strike Wing Alpha II',
  description:
    "When this unit uses Anti-Fighter Barrage, each result of 9 or 10 also destroys 1 of your opponent's infantry in the space area of the active system.",
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'AFB',
      call: ctx => {
        ctx.api.own.declareRollTrigger({
          unitType: [ctx.api.own.getUnitVariantKey(ctx.getUnit())!],
          faces: [9, 10],
          effect: (count, branchCtx) => {
            const infantry = branchCtx.api.opponent.getUnits('INFANTRY', {
              includeVariants: true,
            })
            const toDestroy = infantry.slice(0, count)
            if (toDestroy.length === 0) return
            branchCtx.api.opponent.destroyUnits(toDestroy)
          },
        })
      },
    },
  ],
}
