import type {
  Ability,
  AbilityReadContext,
  DiceContext,
  DiceReadContext,
} from '../../../combat/abilities/types'
import { getParticipatingUnits } from '../../../combat/abilities/utils/get-participating-units'
import type { UnitType } from '../../../types'
import { getUnitListItems } from '../../../utils/get-unit-config'

type Params = {
  isEnabled: boolean
  shipPriority: UnitType[]
}

export const gravleashManeuvers: Ability<Params> = {
  key: 'GRAVLEASH_MANEUVERS',
  name: 'Breakthrough',
  category: 'FACTION',
  defaultParams: {
    isEnabled: false,
    shipPriority: [
      'FLAGSHIP',
      'WAR_SUN',
      'DREADNOUGHT',
      'CRUISER',
      'CARRIER',
      'DESTROYER',
      'FIGHTER',
    ],
  },
  headerUI: 'isEnabled',
  uiConfig: side => {
    const participatingUnits = getParticipatingUnits(side)

    return [
      {
        key: 'shipPriority' as const,
        label: 'Ship Priority',
        type: 'order-list' as const,
        items: getUnitListItems(participatingUnits),
      },
    ]
  },
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      context: 'SPACE_COMBAT',
      isCallable: (
        params: Params,
        _ctx: AbilityReadContext,
        dice: DiceReadContext,
      ) => {
        return params.isEnabled && !dice.own.isEmpty()
      },
      call: (ctx, params: Params, dice: DiceContext) => {
        const shipTypeCount = Object.keys(ctx.api.own.getUnits()).length
        const target = params.shipPriority.find(t => ctx.api.own.hasUnit(t))

        if (shipTypeCount > 0 && target) {
          dice.own.modifyHitValue(-shipTypeCount, target, 0)
        }
      },
    },
  ],
}
