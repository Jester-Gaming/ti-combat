import type { Ability } from '@/combat/abilities/types'
import type { UnitLocator } from '@/types'

export const custodiaVigilia: Ability = {
  key: 'CUSTODIA_VIGILIA',
  name: 'Custodia Vigilia',
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
        dice.own.addDiceGroup('CUSTODIA_VIGILIA', {} as UnitLocator, [5, 1])
      },
    },
  ],
}
