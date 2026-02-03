import { sustainDamage } from '@/data/abilities/sustain-damage'
import type { Faction } from '@/types'

import { fragile } from './fragile'

export const universities_of_jol_nar: Faction = {
  name: 'Universities of Jol-Nar',
  abilities: {
    faction: [fragile],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'J.N.S. Hylarim',
        DESCRIPTION:
          'When making a combat roll for this ship, each result of 9 or 10, before applying modifiers, produces 2 additional hits.',
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
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
  },
}
