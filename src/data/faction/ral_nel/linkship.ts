import { z } from 'zod/mini'

import { type Ability, parseVariantId } from '@/combat'
import type { SideApi } from '@/combat/abilities-engine/api/ability-api'
import type { DiceGroup, UnitBaseType, UnitType } from '@/types'

const STRUCTURE_TYPES: UnitBaseType[] = ['PDS', 'SPACE_DOCK']

type Params = {
  structures: Record<string, number>
}

function expectedHits(sc: DiceGroup): number {
  return (sc[1] + (sc[2] ?? 0)) * (11 - sc[0])
}

function hasStructures(params: Params): boolean {
  return Object.values(params.structures).some(v => v > 0)
}

function findBestSpaceCannon(
  params: Params,
  api: SideApi,
): { key: string; sc: DiceGroup } | null {
  let best: { key: string; sc: DiceGroup } | null = null
  for (const [key, count] of Object.entries(params.structures)) {
    if (count <= 0) continue
    const { type } = parseVariantId(key as UnitType)
    const sc = api.getUnitStats(type)?.UNIT_ABILITIES?.SPACE_CANNON
    if (sc && (!best || expectedHits(sc) > expectedHits(best.sc))) {
      best = { key, sc: [...sc] as DiceGroup }
    }
  }
  return best
}

const uiConfig: Ability<Params>['uiConfig'] = ctx => [
  {
    key: 'structures',
    label: 'Structures',
    type: 'number-list',
    items: ctx.api.own.getUnitVariantsOptions({
      include: STRUCTURE_TYPES,
      includeNonParticipating: true,
    }),
  },
]

// Linkship I: each structure can only be triggered once
export const linkshipI: Ability<Params> = {
  key: 'LINKSHIP',
  name: 'Linkship',
  category: 'FACTION',
  subcategory: 'UNIT',
  context: 'SPACE',
  paramsSchema: z.object({ structures: z.record(z.string(), z.number()) }),
  params: {
    isEnabled: true,
    uses: Infinity,
    structures: {},
  },
  headerUI: 'isEnabled',
  uiConfig,
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'SPACE_CANNON_OFFENSE',
      isCallable: params => hasStructures(params),
      call: (ctx, params, dice) => {
        const best = findBestSpaceCannon(params, ctx.api.own)
        if (!best) return

        dice.own.addDiceGroup('DESTROYER', ctx.getUnit(), best.sc)
        ctx.api.own.updateAbilityConfig({
          structures: (prev: Record<string, number>) => ({
            ...prev,
            [best.key]: prev[best.key] - 1,
          }),
        })
      },
    },
  ],
}

// Linkship II: each linkship can trigger the same structure
export const linkshipII: Ability<Params> = {
  key: 'LINKSHIP',
  name: 'Linkship',
  category: 'FACTION',
  subcategory: 'UNIT',
  context: 'SPACE',
  paramsSchema: z.object({ structures: z.record(z.string(), z.number()) }),
  params: {
    isEnabled: true,
    uses: Infinity,
    structures: {},
  },
  uiConfig,
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'SPACE_CANNON_OFFENSE',
      isCallable: params => hasStructures(params),
      call: (ctx, params, dice) => {
        const best = findBestSpaceCannon(params, ctx.api.own)
        if (!best) return

        dice.own.addDiceGroup('DESTROYER', ctx.getUnit(), best.sc)
      },
    },
  ],
}
