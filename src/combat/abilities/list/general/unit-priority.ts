import { getVariantDisplayName } from '@/combat/utils/unit-variant'

import type { Ability } from '../../types'

type Params = {
  unitPriority: string[]
}

export const unitPriority: Ability<Params> = {
  key: 'UNIT_PRIORITY',
  name: 'Assign Hits Order',
  category: 'GENERAL',
  defaultParams: {
    unitPriority: [
      'FIGHTER',
      'INFANTRY',
      'DESTROYER',
      'CRUISER',
      'CARRIER',
      'DREADNOUGHT',
      'MECH',
      'WAR_SUN',
      'FLAGSHIP',
    ],
  },
  invoke: [],
  uiConfig: ctx => {
    const variants = ctx.api.own.getParticipatingVariants()
    const items = variants.map(id => ({
      label: getVariantDisplayName(id),
      value: id,
    }))

    return [
      {
        key: 'unitPriority' as const,
        label: 'Unit Priority',
        type: 'order-list' as const,
        items,
      },
    ]
  },
}
