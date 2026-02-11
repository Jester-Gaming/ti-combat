import type {
  Ability,
  AbilityCallContext,
  ParamChange,
} from '@/combat/abilities/types'
import { sustainDamage } from '@/data/abilities/unit/sustain-damage'
import type { Faction, UnitDefinition, UnitType } from '@/types'
import { getEffectiveStats } from '@/utils/get-simulation-units'

import { otherFactions } from '../other-factions'
import { mordred } from './mordred'
import { theAlastor } from './the-alastor'

const flagshipAbilities = Object.values(otherFactions).flatMap(faction =>
  (faction.units.FLAGSHIP?.BASE?.ABILITIES ?? [])
    .filter(a => a.subcategory === 'FLAGSHIP')
    .map(ability => ({
      ...ability,
      name: `(${faction.name}) ${ability.name}`,
      readOnly: false,
      params: {
        ...ability.params,
        isEnabled: ability.headerUI === 'isEnabled' ? false : true,
      },
    })),
)

const technologyAbilities = Object.values(otherFactions).flatMap(faction =>
  (faction.abilities?.technology ?? [])
    .filter(a => a.subcategory === 'TECHNOLOGY')
    .map(ability => ({
      ...ability,
      name: `(${faction.name}) ${ability.name}`,
    })),
)

const EXCLUDED_UNIT_TYPES = new Set(['FLAGSHIP', 'MECH', 'SPACE_DOCK'])

function createFactionUnitAbility(
  factionKey: string,
  factionName: string,
  unitType: UnitType,
  unitDef: UnitDefinition,
) {
  const stats = getEffectiveStats(unitDef.BASE, unitDef.UPGRADED, true)
  const displayName = stats.NAME ?? unitDef.BASE.NAME ?? unitType

  // Collect declareParamChange from unit abilities (e.g. Hel-Titan adds PDS to groundForces)
  const paramChanges = (stats.ABILITIES ?? [])
    .filter(a => a.declareParamChange)
    .flatMap(a => a.declareParamChange!(a.params))

  return {
    key: `NEKRO_UNIT_${factionKey}_${unitType}`,
    name: `(${factionName}) ${displayName}`,
    category: 'FACTION',
    subcategory: 'UNIT',
    params: {
      isEnabled: false,
      uses: Infinity,
    },
    headerUI: 'isEnabled',
    ...(paramChanges.length > 0 && {
      declareParamChange: (): ParamChange[] => paramChanges,
    }),
    invoke: [
      {
        timing: 'PREPARE' as const,
        call: (ctx: AbilityCallContext) => {
          ctx.api.own.modifyUnit(unitType, stats)
        },
      },
    ],
  } satisfies Ability
}

const unitAbilities = Object.entries(otherFactions)
  .filter(([factionKey]) => factionKey !== 'NEUTRAL')
  .flatMap(([factionKey, faction]) =>
    (Object.entries(faction.units) as [UnitType, UnitDefinition][])
      .filter(([unitType]) => !EXCLUDED_UNIT_TYPES.has(unitType))
      .map(([unitType, unitDef]) =>
        createFactionUnitAbility(factionKey, faction.name, unitType, unitDef),
      ),
  )

export const nekro_virus: Faction = {
  name: 'Nekro Virus',
  abilities: {
    technology: technologyAbilities,
    unit: unitAbilities,
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'The Alastor',
        DESCRIPTION:
          'At the start of a space combat, choose any number of your ground forces in this system to participate in that combat as if they were ships.',
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
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [mordred, sustainDamage],
      },
    },
  },
}
