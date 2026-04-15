import yinBrotherhoodIcon from '@/assets/faction/yin_brotherhood.svg?raw'
import type { Ability } from '@/combat'

export const greyfireMutagen: Ability = {
  key: 'GREYFIRE_MUTAGEN',
  name: 'Greyfire Mutagen',
  description:
    "At the start of a ground combat against 2 or more ground forces that are not controlled by the Yin player: Replace 1 of your opponent's infantry with 1 infantry from your reinforcements.",
  icon: yinBrotherhoodIcon,
  category: 'PROMISSORY',
  context: 'GROUND',
  params: { isEnabled: false, uses: 1 },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (_params, ctx) => {
        if (ctx.api.opponent.getFaction() === 'YIN_BROTHERHOOD') return false
        const { groundForces } = ctx.api.opponent.getAbilityConfig('SETTINGS')
        if (ctx.api.opponent.countUnits(groundForces) < 2) return false
        return ctx.api.opponent.hasUnitType('INFANTRY')
      },
      call: ctx => {
        ctx.api.opponent.removeUnits('INFANTRY')
        ctx.api.own.placeUnits({ INFANTRY: 1 })
      },
    },
  ],
}
