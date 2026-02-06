import type { Ability } from '@/combat/abilities/types'
import { GROUND_FORCES } from '@/constants/units'

type Params = { isEnabled: boolean }

const GROUND_FORCES_SET = new Set(GROUND_FORCES)

export const greyfireMutagen: Ability<Params> = {
  key: 'GREYFIRE_MUTAGEN',
  name: '(Yin) Greyfire Mutagen',
  category: 'PROMISSORY',
  context: 'GROUND',
  params: { isEnabled: false },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params, ctx) => {
        if (!params.isEnabled) return false
        if (ctx.api.opponent.getFaction() === 'YIN_BROTHERHOOD') return false
        if (ctx.api.opponent.countUnits(GROUND_FORCES_SET) < 2) return false
        return ctx.api.opponent.hasUnit('INFANTRY')
      },
      call: ctx => {
        ctx.api.opponent.removeUnit('INFANTRY')
        ctx.api.own.addUnit({ INFANTRY: 1 })
      },
    },
  ],
}
