import { getVariantDisplayName } from '@/combat/utils/unit-variant'

import type { Ability } from '../../types'

type Params = {
  spaceUnitPriority: string[]
  groundUnitPriority: string[]
}

export const unitPriority: Ability<Params> = {
  key: 'UNIT_PRIORITY',
  name: 'Assign Hits Order',
  category: 'GENERAL',
  defaultParams: {
    spaceUnitPriority: [
      'FIGHTER',
      'DESTROYER',
      'CRUISER',
      'CARRIER',
      'DREADNOUGHT',
      'WAR_SUN',
      'FLAGSHIP',
    ],
    groundUnitPriority: ['INFANTRY', 'PDS', 'MECH'],
  },
  invoke: [],
  uiConfig: ctx => {
    const variants = ctx.api.own.getParticipatingVariants()
    const items = variants.map(id => ({
      label: getVariantDisplayName(id),
      value: id,
    }))

    const key =
      ctx.state.combatMode === 'GROUND'
        ? ('groundUnitPriority' as const)
        : ('spaceUnitPriority' as const)

    return [
      {
        key,
        label: 'Unit Priority',
        type: 'order-list' as const,
        items,
      },
    ]
  },
}
