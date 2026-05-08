import { z } from 'zod/mini'

import { TIMING_GROUPS } from '@/combat/abilities-engine/abilities-engine'
import { UnitListSchema } from '@/types'

import type { Ability } from '../../../combat/abilities-engine/types'

type Params = {
  startOfCombat: [string][]
  beforeDiceRoll: [string][]
  beforeUnitAbilityRoll: [string][]
  beforeAssignHits: [string][]
  endOfCombat: [string][]
}

export const abilityOrder: Ability<Params> = {
  key: 'ABILITY_ORDER',
  name: 'Resolve Order',
  paramsSchema: z.object({
    startOfCombat: UnitListSchema,
    beforeDiceRoll: UnitListSchema,
    beforeUnitAbilityRoll: UnitListSchema,
    beforeAssignHits: UnitListSchema,
    endOfCombat: UnitListSchema,
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    startOfCombat: [],
    beforeDiceRoll: [],
    beforeUnitAbilityRoll: [],
    beforeAssignHits: [],
    endOfCombat: [],
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
        type: 'unit-list' as const,
        mode: 'order' as const,
        items: abilities.map(a => ({ label: a.name, value: a.key })),
      })
    }
    return items
  },
}
