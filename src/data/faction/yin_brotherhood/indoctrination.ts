import type { Ability } from '@/combat'

export const indoctrination: Ability = {
  key: 'INDOCTRINATION',
  name: 'Indoctrination',
  category: 'FACTION',
  subcategory: 'ABILITY',
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
        ctx.api.opponent.removeUnit('INFANTRY')
        const [placedId] = ctx.api.own.placeUnits({ INFANTRY: 1 }).INFANTRY
        ctx.trigger('WHEN_INDOCTRINATION', placedId)
      },
    },
  ],
}
