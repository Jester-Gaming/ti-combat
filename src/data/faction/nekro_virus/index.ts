import nekroVirusIcon from '@/assets/faction/nekro_virus.svg?raw'
import type { Ability } from '@/combat'
import type {
  AbilityCallContext,
  ParamChange,
  SettingsParams,
} from '@/combat/abilities-engine/types'
import { sustainDamage } from '@/data/abilities/unit/sustain-damage'
import baseUnits from '@/data/base-units'
import type { Faction, UnitBaseType, UnitDefinition } from '@/types'
import { getEffectiveStats } from '@/utils/get-simulation-units'

import { otherFactions } from '../other-factions'
import { mordred } from './mordred'
import { createTechnologicalSingularity } from './technological-singularity'
import { theAlastor } from './the-alastor'

// ---------------------------------------------------------------------------
// Collect flagship abilities from other factions
// ---------------------------------------------------------------------------

const flagshipAbilities = Object.values(otherFactions).flatMap(faction =>
  (faction.units.FLAGSHIP?.BASE?.ABILITIES ?? [])
    .filter(a => a.subcategory === 'FLAGSHIP')
    .map(ability => ({
      ...ability,
      key: `NEKRO_FLAGSHIP_${ability.key}`,
      name: ability.name,
      icon: faction.icon,
      readOnly: false,
      params: {
        ...ability.params,
        isEnabled: ability.headerUI === 'isEnabled' ? false : true,
      },
    })),
)

// ---------------------------------------------------------------------------
// Collect technology abilities from other factions
// ---------------------------------------------------------------------------

const technologyAbilities = Object.values(otherFactions).flatMap(faction =>
  (faction.abilities?.technology ?? [])
    .filter(a => a.subcategory === 'TECHNOLOGY')
    .map(ability => ({
      ...ability,
      name: ability.name,
      icon: faction.icon,
    })),
)

// ---------------------------------------------------------------------------
// Collect unit abilities from other factions
// ---------------------------------------------------------------------------

const EXCLUDED_UNIT_TYPES = new Set(['FLAGSHIP', 'MECH', 'SPACE_DOCK'])

const STANDARD_ABILITY_KEYS = new Set([
  'SUSTAIN_DAMAGE',
  'PLANETARY_SHIELD',
  'DISABLE_PLANETARY_SHIELD',
])

function createFactionUnitAbility(
  factionKey: string,
  faction: Faction,
  unitType: UnitBaseType,
  unitDef: UnitDefinition,
): Ability {
  const key = `NEKRO_UNIT_${factionKey}_${unitType}`
  const stats = getEffectiveStats(unitDef.BASE, unitDef.UPGRADED, true)
  const defaultStats = {
    ...(baseUnits as Record<string, { BASE: Record<string, unknown> }>)[
      unitType
    ]?.BASE,
  }
  const displayName = stats.NAME ?? unitDef.BASE.NAME ?? unitType

  const mainAbility = (stats.ABILITIES ?? []).find(
    a => !STANDARD_ABILITY_KEYS.has(a.key),
  )

  const effectiveStats = mainAbility
    ? {
        ...stats,
        ABILITIES: stats.ABILITIES!.map(a =>
          a === mainAbility ? { ...a, key } : a,
        ),
      }
    : stats

  // Extract child's custom params (exclude base params)
  const childCustomParams: Record<string, unknown> = {}
  if (mainAbility) {
    for (const [k, v] of Object.entries(mainAbility.params)) {
      if (k !== 'isEnabled' && k !== 'uses') childCustomParams[k] = v
    }
  }

  // Collect declareParamChange from unit abilities (e.g. Hel-Titan adds PDS to groundForces)
  const paramChanges = (stats.ABILITIES ?? [])
    .filter(a => a.declareParamChange)
    .flatMap(a => a.declareParamChange!(a.params, {} as SettingsParams))

  return {
    key,
    name: displayName,
    icon: faction.icon,
    category: 'FACTION',
    subcategory: 'UNIT',
    exclusiveGroup: unitType,
    params: {
      isEnabled: false,
      uses: Infinity,
      ...childCustomParams,
    },
    headerUI: 'isEnabled',
    ...(mainAbility?.uiConfig && { uiConfig: mainAbility.uiConfig }),
    ...(paramChanges.length > 0 && {
      declareParamChange: (): ParamChange[] => paramChanges,
    }),
    invoke: [
      {
        timing: 'PREPARE' as const,
        call: (ctx: AbilityCallContext) => {
          // Save original stats before overwriting
          const original = ctx.api.own.getUnitStats(unitType)
          if (original) {
            ctx.api.own.updateAbilityConfig(key, {
              _savedStats: { ...original },
            })
          }
          ctx.api.own.modifyUnitType(unitType, effectiveStats)
          // Run child ability's config-level PREPARE invokes
          if (mainAbility) {
            for (const inv of mainAbility.invoke) {
              if (inv.timing !== 'PREPARE') continue
              ;(inv.call as (c: AbilityCallContext) => void)(ctx)
            }
          }
        },
      },
      {
        timing: 'CLEANUP' as const,
        call: (ctx: AbilityCallContext) => {
          const config = ctx.api.own.getAbilityConfig(key)
          const saved = config?._savedStats as
            | Record<string, unknown>
            | undefined
          ctx.api.own.modifyUnitType(unitType, saved ?? defaultStats)
          // Run child ability's config-level CLEANUP invokes
          if (mainAbility) {
            for (const inv of mainAbility.invoke) {
              if (inv.timing !== 'CLEANUP') continue
              ;(inv.call as (c: AbilityCallContext) => void)(ctx)
            }
          }
        },
      },
    ],
  }
}

const unitAbilities = Object.entries(otherFactions)
  .filter(([factionKey]) => factionKey !== 'NEUTRAL')
  .flatMap(([factionKey, faction]) =>
    (Object.entries(faction.units) as [UnitBaseType, UnitDefinition][])
      .filter(([unitType]) => !EXCLUDED_UNIT_TYPES.has(unitType))
      .map(([unitType, unitDef]) =>
        createFactionUnitAbility(factionKey, faction, unitType, unitDef),
      ),
  )

const technologicalSingularity = createTechnologicalSingularity(
  [...flagshipAbilities, ...technologyAbilities, ...unitAbilities],
  [...technologyAbilities, ...unitAbilities],
  mordred,
)

// ---------------------------------------------------------------------------
// Export faction
// ---------------------------------------------------------------------------

export const nekro_virus: Faction = {
  name: 'Nekro Virus',
  icon: nekroVirusIcon,
  abilities: {
    faction: [technologicalSingularity],
    technology: [...technologyAbilities, ...unitAbilities],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'The Alastor',
        DESCRIPTION:
          'At the start of a space combat, choose any number of your ground forces in this system to participate in that combat as if they were ships.',
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [9, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [theAlastor, sustainDamage, ...flagshipAbilities],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Mordred',
        DESCRIPTION:
          'During combat against an opponent who has an "X" or "Y" token on 1 or more of their technologies, apply +2 to the result of each of this unit\'s combat rolls.',
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [mordred, sustainDamage],
      },
    },
  },
}
