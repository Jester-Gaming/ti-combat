import { TIMING_GROUPS } from '@/combat/abilities-engine/abilities-engine'

import type { Ability } from '../../../combat/abilities-engine/types'

type Params = {
  startOfCombat: string[]
  beforeDiceRoll: string[]
  beforeUnitAbilityRoll: string[]
  beforeAssignHits: string[]
}

export const abilityOrder: Ability<Params> = {
  key: 'ABILITY_ORDER',
  name: 'Resolve Order',
  category: 'GENERAL',
  params: {
    isEnabled: true,
    uses: Infinity,
    startOfCombat: [],
    beforeDiceRoll: [],
    beforeUnitAbilityRoll: [],
    beforeAssignHits: [],
  },
  invoke: [],
  uiConfig: ctx => {
    const items = []
    for (const group of TIMING_GROUPS) {
      const abilities = ctx.getAbilitiesForTiming(group.timings)
      if (abilities.length < 1) continue
      items.push({
        key: group.paramKey as keyof Params,
        label: group.label,
        type: 'order-list' as const,
        items: abilities.map(a => ({ label: a.name, value: a.key })),
      })
    }
    return items
  },
}
