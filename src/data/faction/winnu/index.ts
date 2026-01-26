import type { Faction } from '@/types'

export const winnu: Faction = {
  name: 'Winnu',
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Salai Sai Corian',
        DESCRIPTION:
          "When this unit makes a combat roll, it rolls a number of dice equal to the number of your opponent's non-fighter ships in this system.",
        COST: 8,
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
      },
    },
    MECH: {
      BASE: {
        NAME: 'Reclaimer',
        DESCRIPTION:
          'After you resolve a tactical action during which you gained control of this planet, you may place 1 PDS or 1 space dock from your reinforcements on this planet.',
        COST: 2,
        COMBAT: [6, 1],
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
      },
    },
  },
}
