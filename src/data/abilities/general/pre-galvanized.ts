import { z } from 'zod/mini'

import {
  type Ability,
  type AbilityCallContext,
  makeVariantId,
  type ParamChange,
} from '@/combat'
import type { UnitStats, UnitType, UnitVariantId } from '@/types'

type Params = {
  galvanizedUnits: Partial<Record<UnitType, number | undefined>>
  reinforcementTokens: number
}

export const GALVANIZED = 'Galvanized' as UnitVariantId

const bumpDice = <T extends [number, number] | [number, number, number]>(
  dice: T | undefined,
): T | undefined =>
  dice === undefined ? undefined : ([dice[0], dice[1], (dice[2] ?? 0) + 1] as T)

export function galvanizeStats(stats: UnitStats): UnitStats {
  const combat = stats.COMBAT ? bumpDice(stats.COMBAT) : stats.COMBAT
  const abilities = stats.UNIT_ABILITIES
  const nextAbilities = abilities
    ? {
        ...abilities,
        BOMBARDMENT: bumpDice(abilities.BOMBARDMENT),
        AFB: bumpDice(abilities.AFB),
        SPACE_CANNON: bumpDice(abilities.SPACE_CANNON),
      }
    : abilities
  return { ...stats, COMBAT: combat, UNIT_ABILITIES: nextAbilities }
}

/** Galvanize one unit of the given type — moves it to the Galvanized subtype
 *  with +1 bonus die on COMBAT, BOMBARDMENT, AFB, and SPACE_CANNON. Emits
 *  `WHEN_GALVANIZE` with the newly galvanized UnitId.
 *  Pass `consumeToken: true` to consume one reinforcement token from
 *  PRE_GALVANIZED; returns false if the token pool is empty. */
export function galvanizeUnit(
  ctx: AbilityCallContext,
  unitType: UnitType,
  consumeToken?: boolean,
): boolean {
  const api = ctx.api.own
  if (consumeToken) {
    const tokens =
      (api.getAbilityConfig('PRE_GALVANIZED')?.reinforcementTokens as
        | number
        | undefined) ?? 0
    if (tokens <= 0) return false
    api.updateAbilityConfig('PRE_GALVANIZED', {
      reinforcementTokens: tokens - 1,
    })
  }
  api.addSubtype(unitType, GALVANIZED, galvanizeStats)
  const galvanizedVariant = makeVariantId(unitType, [GALVANIZED])
  const ids = api.getUnits(galvanizedVariant)
  const movedId = ids[ids.length - 1]
  if (movedId !== undefined) ctx.trigger('WHEN_GALVANIZE', movedId)
  return true
}

/** Declare a Galvanized subtype for a given unit type — for use inside an
 *  ability's `declareParamChange` so the Galvanized variant is registered in
 *  SETTINGS.subtypes and appears in UI dropdowns. */
export function declareGalvanizeUnits(unitType: UnitType): ParamChange {
  return { key: 'subtypes', value: { name: GALVANIZED, unitType } }
}

export const preGalvanized: Ability<Params> = {
  key: 'PRE_GALVANIZED',
  name: 'Galvanized Units',
  category: 'GENERAL',
  paramsSchema: z.object({
    galvanizedUnits: z.record(z.string(), z.optional(z.number())),
    reinforcementTokens: z.number(),
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    galvanizedUnits: {},
    reinforcementTokens: 7,
  },
  declareParamChange: params => {
    const changes: ParamChange[] = []
    for (const [unitType, count] of Object.entries(params.galvanizedUnits)) {
      if ((count ?? 0) <= 0) continue
      changes.push(declareGalvanizeUnits(unitType as UnitType))
    }
    return changes
  },
  uiConfig: ctx => {
    const items = ctx.api.own.getUnitVariantsOptions({
      excludeSubtypes: [GALVANIZED],
    })

    const tokens = {
      key: 'reinforcementTokens' as const,
      label: 'Tokens in reinforcement',
      type: 'number' as const,
      min: 0,
    }

    return items.length > 0
      ? [
          tokens,
          {
            key: 'galvanizedUnits' as const,
            type: 'number-list' as const,
            items,
          },
        ]
      : [tokens]
  },
  invoke: [
    {
      timing: 'PREPARE',
      call: (ctx, params) => {
        for (const [unitType, count] of Object.entries(
          params.galvanizedUnits,
        )) {
          const ids = ctx.api.own.getUnits(unitType as UnitType)
          const max = Math.min(count ?? 0, ids.length)
          for (let i = 0; i < max; i++) {
            galvanizeUnit(ctx, unitType as UnitType)
          }
        }
      },
    },
  ],
}
