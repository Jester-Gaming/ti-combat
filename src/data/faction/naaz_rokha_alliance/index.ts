import type { Faction } from '@/types'

import { eidolon } from './eidolon'
import { supercharge } from './supercharge'

export const naaz_rokha_alliance: Faction = {
  name: 'Naaz-Rokha Alliance',
  abilities: {
    faction: [supercharge],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Visz El Vir',
        DESCRIPTION:
          'Your mechs in this system roll 1 additional die during combat.',
        COST: 8,
        COMBAT: [9, 2],
        MOVE: 1,
        CAPACITY: 4,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
      },
    },
    MECH: {
      BASE: {
        NAME: 'Eidolon',
        DESCRIPTION:
          'If this unit is in the space area of the active system at the start of a space combat, flip this card.',
        COST: 2,
        COMBAT: [6, 2],
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [eidolon],
      },
    },
  },
}
