import { sustainDamage } from '@/data/abilities/unit/sustain-damage'
import type { Faction } from '@/types'

import { brotherMilor } from './brother-milor'
import { devotion } from './devotion'
import { impulseCore } from './impulse-core'
import { indoctrination } from './indoctrination'

export const yin_brotherhood: Faction = {
  name: 'Yin Brotherhood',
  abilities: {
    faction: [devotion, indoctrination],
    technology: [impulseCore],
    agent: [brotherMilor],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Van Hauge',
        DESCRIPTION:
          'When this ship is destroyed, destroy all ships in this system.',
        COST: 8,
        COMBAT: [9, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: "Moyin's Ashes",
        DESCRIPTION:
          "Deploy: When you use your Indoctrination faction ability, you may spend 1 additional influence to replace your opponent's unit with 1 mech instead of 1 infantry.",
        COST: 2,
        COMBAT: [6, 1],
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
  },
}
