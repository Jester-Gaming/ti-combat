import { z } from 'zod/mini'

import type { Ability, ParamChange } from '@/combat'
import type { UnitStats, UnitType, UnitVariantId } from '@/types'

import type { SideApi } from '../../../combat/abilities-engine/api/ability-api'

type Params = {
  galvanizedUnits: Partial<Record<UnitType, number | undefined>>
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
 *  with +1 bonus die on COMBAT, BOMBARDMENT, AFB, and SPACE_CANNON. */
export function galvanizeUnit(api: SideApi, unitType: UnitType): void {
  api.addSubtype(unitType, GALVANIZED, galvanizeStats)
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
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    galvanizedUnits: {},
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

    return items.length > 0
      ? [
          {
            key: 'galvanizedUnits',
            type: 'number-list',
            items,
          },
        ]
      : []
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
            galvanizeUnit(ctx.api.own, unitType as UnitType)
          }
        }
      },
    },
  ],
}
