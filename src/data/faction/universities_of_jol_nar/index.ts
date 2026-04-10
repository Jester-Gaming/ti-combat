import universitiesOfJolNarIcon from '@/assets/faction/universities_of_jol_nar.svg?raw'
import { sustainDamage } from '@/data/abilities/unit/sustain-damage'
import type { Faction } from '@/types'

import { fragile } from './fragile'
import { shieldPaling } from './shield-paling'

export const universities_of_jol_nar: Faction = {
  name: 'Universities of Jol-Nar',
  icon: universitiesOfJolNarIcon,
  abilities: {
    faction: [fragile],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'J.N.S. Hylarim',
        DESCRIPTION:
          'When making a combat roll for this ship, each result of 9 or 10, before applying modifiers, produces 2 additional hits.',
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [6, 2],
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
        NAME: 'Shield Paling',
        DESCRIPTION:
          'Your infantry on this planet are not affected by your Fragile faction ability.',
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [shieldPaling, sustainDamage],
      },
    },
  },
}
