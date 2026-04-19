import { z } from 'zod/mini'

import { type Ability, type AbilityReadContext, parseVariantId } from '@/combat'
import { GALVANIZED } from '@/data/abilities/general/pre-galvanized'
import type { UnitType } from '@/types'

type Params = {
  resolveBombardment: boolean
}

export const proximaTargetingVi: Ability<Params> = {
  key: 'PROXIMA_TARGETING_VI',
  name: 'Proxima Targeting VI',
  description:
    "Cancel 1 hit produced by Bombardment rolls made against your ground forces for each of your galvanized units present. At the start of a round of ground combat you may resolve Bombardment 8 (x3) against your opponent's ground forces; if you do, make an identical roll against your own ground forces.",
  category: 'FACTION',
  subcategory: 'TECHNOLOGY',
  context: 'GROUND',
  paramsSchema: z.object({
    resolveBombardment: z.boolean(),
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    resolveBombardment: false,
  },
  headerUI: 'isEnabled',
  uiConfig: [
    {
      key: 'resolveBombardment',
      label: 'Resolve Bombardment',
      type: 'checkbox',
    },
  ],
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      context: 'BOMBARDMENT',
      isCallable: (_params, ctx) => {
        if (ctx.api.own.getPendingHits() === 0) return false
        return countGalvanizedUnits(ctx) > 0
      },
      call: ctx => {
        ctx.api.own.reduceHits(countGalvanizedUnits(ctx))
      },
    },
    {
      timing: 'START_OF_COMBAT_ROUND',
      context: 'GROUND_COMBAT',
      isCallable: params => params.resolveBombardment,
      call: ctx => {
        ctx.resolveStep('BOMBARDMENT', { dice: [[8, 3]] }, branchCtx => {
          branchCtx.resolveStep('BOMBARDMENT', {
            dice: [[8, 3]],
            target: 'OWN',
          })
        })
      },
    },
  ],
}

function countGalvanizedUnits(ctx: AbilityReadContext): number {
  const units = ctx.state[ctx.side].units
  let count = 0
  for (const key of Object.keys(units)) {
    const { subtypes } = parseVariantId(key as UnitType)
    if (!subtypes.includes(GALVANIZED)) continue
    count += units[key as UnitType].length
  }
  return count
}
