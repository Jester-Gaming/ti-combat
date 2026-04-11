import type { Ability } from '@/combat'
import type { UnitId } from '@/types'

export const custodiaVigilia: Ability = {
  key: 'CUSTODIA_VIGILIA',
  name: 'Custodia Vigilia',
  description:
    'While you control Mecatol Rex, it gains Space Cannon 5 and Production 3.',
  category: 'FACTION',
  subcategory: 'ABILITY',
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: ['SPACE_CANNON_OFFENSE', 'SPACE_CANNON_DEFENSE'],
      call: (_ctx, _params, dice) => {
        dice.own.addDiceGroup('CUSTODIA_VIGILIA', 0 as UnitId, [5, 1])
      },
    },
  ],
}
