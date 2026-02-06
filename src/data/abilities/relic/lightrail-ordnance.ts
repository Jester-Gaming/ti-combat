import type {
  Ability,
  AbilityReadContext,
  DiceContext,
} from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const lightrailOrdnance: Ability<Params> = {
  key: 'LIGHTRAIL_ORDNANCE',
  name: 'Lightrail Ordnance',
  category: 'RELIC',
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: ['SPACE_CANNON_OFFENSE', 'SPACE_CANNON_DEFENSE'],
      isCallable: (params: Params, ctx: AbilityReadContext) =>
        params.isEnabled && ctx.api.own.hasUnit('SPACE_DOCK'),
      call: (ctx, _params: Params, dice: DiceContext) => {
        const spaceDocks = ctx.api.own.getUnits('SPACE_DOCK')
        for (const dock of spaceDocks) {
          dice.own.addDiceGroup('SPACE_DOCK', dock, [5, 2])
        }
      },
    },
  ],
}
