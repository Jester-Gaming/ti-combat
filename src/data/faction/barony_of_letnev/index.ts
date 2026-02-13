import baronyOfLetnevIcon from '@/assets/faction/barony_of_letnev.svg?raw'
import { sustainDamage } from '@/data/abilities/unit/sustain-damage'
import type { Faction } from '@/types'

import { arcSecundus } from './arc-secundus'
import { dunlainReaper } from './dunlain-reaper'
import { gravleashManeuvers } from './gravleash-maneuvers'
import { l4Disruptors } from './l4-disruptors'
import { nonEuclideanShielding } from './non-euclidean-shielding'
import { viscountUnlenn } from './viscount-unlenn'

export const barony_of_letnev: Faction = {
  name: 'Barony of Letnev',
  icon: baronyOfLetnevIcon,
  abilities: {
    faction: [dunlainReaper],
    technology: [l4Disruptors, nonEuclideanShielding],
    agent: [viscountUnlenn],
    breakthrough: [gravleashManeuvers],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Arc Secundus',
        DESCRIPTION:
          "Other players' units in this system lose Planetary Shield. At the start of each space combat round, repair this ship.",
        COST: 8,
        COMBAT: [5, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          BOMBARDMENT: [5, 3],
        },
        ABILITIES: [arcSecundus, sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Dunlain Reaper',
        DESCRIPTION:
          'Deploy: At the start of a round of ground combat, you may spend 2 resources to replace 1 of your infantry in that combat with 1 mech.',
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
