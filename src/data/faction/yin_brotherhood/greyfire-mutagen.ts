import yinBrotherhoodIcon from '@/assets/faction/yin_brotherhood.svg?raw'
import type { Ability } from '@/combat/abilities/types'
import { GROUND_FORCES } from '@/constants/units'

export const greyfireMutagen: Ability = {
  key: 'GREYFIRE_MUTAGEN',
  name: 'Greyfire Mutagen',
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
        if (ctx.api.opponent.countUnits(GROUND_FORCES) < 2) return false
        return ctx.api.opponent.hasUnit('INFANTRY')
      },
      call: ctx => {
        ctx.api.opponent.removeUnit('INFANTRY')
        ctx.api.own.placeUnits({ INFANTRY: 1 })
      },
    },
  ],
}
