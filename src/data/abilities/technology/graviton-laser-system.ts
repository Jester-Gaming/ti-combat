import type { Ability } from '../../../combat/abilities-engine/types'
import { parseVariantId } from '../../../combat/utils'
import type { UnitType } from '../../../types'

export const gravitonLaserSystem: Ability = {
  key: 'GRAVITON_LASER_SYSTEM',
  name: 'Graviton Laser System',
  description:
    'You may exhaust this card before 1 or more of your units use Space Cannon; hits produced by those units must be assigned to non-fighter ships if able.',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'SPACE_CANNON_OFFENSE',
      call: ctx => {
        const priority =
          ctx.api.opponent.getAbilityConfig('UNIT_PRIORITY')?.scoUnitPriority ??
          []
        const isFighter = ([v]: [string]) =>
          parseVariantId(v as UnitType).type === 'FIGHTER'
        ctx.api.opponent.updateAbilityConfig('UNIT_PRIORITY', {
          scoUnitPriority: [
            ...priority.filter(p => !isFighter(p)),
            ...priority.filter(p => isFighter(p)),
          ],
        })
      },
    },
  ],
}
