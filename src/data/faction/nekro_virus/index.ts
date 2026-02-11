import { sustainDamage } from '@/data/abilities/unit/sustain-damage'
import type { Faction } from '@/types'

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

export const nekro_virus: Faction = {
  name: 'Nekro Virus',
  abilities: {
    technology: technologyAbilities,
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
