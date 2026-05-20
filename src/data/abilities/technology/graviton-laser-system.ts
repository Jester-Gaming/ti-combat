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
        const opp = ctx.api.opponent
        const sc = opp.getAbilityConfig('SPACE_CANNON_OFFENSE')
        const priority = sc?.customScoPriority
          ? (sc.scoUnitPriority ?? [])
          : (opp.getAbilityConfig('UNIT_PRIORITY')?.spaceUnitPriority ?? [])
        const isFighter = ([v]: [UnitType]) =>
          parseVariantId(v as UnitType).type === 'FIGHTER'
        opp.updateAbilityConfig('SPACE_CANNON_OFFENSE', {
          customScoPriority: true,
          scoUnitPriority: [
            ...priority.filter(p => !isFighter(p)),
            ...priority.filter(p => isFighter(p)),
          ],
        })
      },
    },
  ],
}
