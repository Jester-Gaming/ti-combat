import { sustainDamage } from '@/data/abilities/sustain-damage'
import type { Faction } from '@/types'

export const council_keleres: Faction = {
  name: 'Council Keleres',
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Artemiris',
        DESCRIPTION:
          'Other players must spend 2 influence to activate this system.',
        COST: 8,
        COMBAT: [7, 2],
        MOVE: 1,
        CAPACITY: 6,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Omniopiares',
        DESCRIPTION:
          'Other players must spend 1 influence to commit ground forces to this planet.',
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
