import { getVariantDisplayName } from '@/combat/utils/unit-variant'

import { declareParam } from '../../../combat/abilities/declare-param'
import type { Ability } from '../../../combat/abilities/types'

type Params = {
  spaceUnitPriority: string[]
  groundUnitPriority: string[]
}

export const unitPriority: Ability<Params> = {
  key: 'UNIT_PRIORITY',
  name: 'Assign Hits Order',
  category: 'GENERAL',
  params: {
    spaceUnitPriority: declareParam({
      default: [],
      source: 'spaceCombatParticipating',
    }),
    groundUnitPriority: declareParam({
      default: [],
      source: 'groundCombatParticipating',
    }),
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
