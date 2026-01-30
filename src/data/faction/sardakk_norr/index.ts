import { sardakkFlagshipAbility } from '@/data/faction/sardakk_norr/flagship-ability'
import { tekklarLegion } from '@/data/faction/sardakk_norr/tekklar-legion'
import { unrelenting } from '@/data/faction/sardakk_norr/unrelenting'
import type { Faction } from '@/types'

export const sardakk_norr: Faction = {
  name: "Sardakk N'orr",
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: "C'morran N'orr",
        DESCRIPTION:
          "Apply +1 to the result of each of your other ship's combat rolls in this system.",
        COST: 8,
        COMBAT: [6, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sardakkFlagshipAbility],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Valkyrie Exoskeleton',
        DESCRIPTION:
          "After this unit uses its Sustain Damage ability during ground combat, it produces 1 hit against your opponent's ground forces on this planet.",
        COST: 2,
        COMBAT: [6, 1],
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
      },
    },
    DREADNOUGHT: {
      BASE: {
        NAME: 'Exotrireme I',
        COST: 4,
        COMBAT: [5, 1],
        MOVE: 1,
        CAPACITY: 1,
        UNIT_ABILITIES: {
          BOMBARDMENT: [4, 2],
          SUSTAIN_DAMAGE: true,
        },
      },
      UPGRADED: {
        NAME: 'Exotrireme II',
        DESCRIPTION:
          'This unit cannot be destroyed by Direct Hit action cards. After a round of space combat, you may destroy this unit to destroy up to 2 ships in this system.',
        MOVE: 2,
      },
    },
  },
  abilities: {
    faction: [unrelenting],
    promissory: [tekklarLegion],
  },
}
