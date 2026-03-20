import type { Ability } from '../../../combat/abilities-engine/types'
import { parseVariantId } from '../../../combat/utils'
import type { UnitType } from '../../../types'

export const gravitonLaserSystem: Ability = {
  key: 'GRAVITON_LASER_SYSTEM',
  name: 'Graviton Laser System',
  category: 'TECHNOLOGY',
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
        const { scoUnitPriority } =
          ctx.api.opponent.getAbilityConfig('UNIT_PRIORITY')
        const priority = scoUnitPriority as UnitType[]
        const isFighter = (v: UnitType) => parseVariantId(v).type === 'FIGHTER'
        ctx.api.opponent.updateAbilityConfig('UNIT_PRIORITY', {
          scoUnitPriority: [
            ...priority.filter(v => !isFighter(v)),
            ...priority.filter(v => isFighter(v)),
          ],
        })
      },
    },
  ],
}
