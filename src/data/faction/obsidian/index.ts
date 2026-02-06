import { sustainDamage } from '@/data/abilities/unit/sustain-damage'
import type { Faction } from '@/types'

import { arozHollow } from './aroz-hollow'
import { assail } from './assail'
import { vosHollow } from './vos-hollow'

export const obsidian: Faction = {
  name: 'Obsidian',
  abilities: {
    faction: [assail],
    agent: [vosHollow],
    commander: [arozHollow],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: "Heaven's Hollow",
        COST: 8,
        COMBAT: [5, 3],
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
        NAME: 'Viper Hollow',
        DESCRIPTION:
          "If this unit was coexisting when this card flipped to this side, gain control of its planet; the other player's units are now coexisting.",
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
