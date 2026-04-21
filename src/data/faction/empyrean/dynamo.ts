import type { Ability } from '../../../combat/abilities-engine/types'

type Params = {
  isEnabled: boolean
  uses: number
}

export const dynamo: Ability<Params> = {
  key: 'DYNAMO',
  name: 'Dynamo',
  description:
    "After any player's unit in this system or an adjacent system uses Sustain Damage, you may spend 2 influence to repair that unit.",
  category: 'FACTION',
  subcategory: 'FLAGSHIP',
  allowExternal: true,
  params: {
    isEnabled: true,
    uses: 0,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'AFTER_SUSTAIN_DAMAGE_USE',
      isCallable: (_, ctx, unitId) => ctx.api.own.hasUnit(unitId),
      call: (ctx, _params, unitId) => {
        ctx.api.own.modifyUnitState(unitId, { isDamaged: false })
      },
    },
    {
      timing: 'DESTROY',
      isCallable: (_params, ctx, units) =>
        ctx.isOwner() && (units.own.FLAGSHIP?.length ?? 0) > 0,
      call: ctx => {
        ctx.api.own.updateAbilityConfig({ uses: 0 })
      },
    },
  ],
}
