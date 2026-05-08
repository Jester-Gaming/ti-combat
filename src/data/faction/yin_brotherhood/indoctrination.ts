import type { Ability } from '@/combat'
import type { UnitId } from '@/types'

/** Fires with the UnitId of the infantry swapped in by Indoctrination. */
declare global {
  interface TimingContextMap {
    WHEN_INDOCTRINATION: UnitId
  }
}

export const indoctrination: Ability = {
  key: 'INDOCTRINATION',
  name: 'Indoctrination',
  description:
    "At the start of a ground combat, you may spend 2 influence to replace 1 of your opponent's participating infantry with 1 infantry from your reinforcements.",
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (_params, ctx) => {
        return ctx.api.opponent.hasUnitType('INFANTRY')
      },
      call: ctx => {
        ctx.api.opponent.removeUnits('INFANTRY')
        const [placedId] = ctx.api.own.placeUnits({ INFANTRY: 1 }).INFANTRY
        ctx.trigger('WHEN_INDOCTRINATION', placedId)
      },
    },
  ],
}
