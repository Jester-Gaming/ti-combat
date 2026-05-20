import type { Ability } from '../../../combat/abilities-engine/types'

declare global {
  interface AbilityConfigMap {
    SPACE_CANNON_DEFENSE: Record<string, never>
  }
}

export const spaceCannonDefense: Ability = {
  key: 'SPACE_CANNON_DEFENSE',
  name: 'Space Cannon Defense',
  description: 'Space Cannon Defense is resolved only when enabled',
  side: 'defender',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'SPACE_CANNON_DEFENSE_STEP',
      call: ctx => ctx.resolveStep('SPACE_CANNON_DEFENSE'),
    },
  ],
}
