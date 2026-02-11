import firmamentIcon from '@/assets/faction/firmament.svg?raw'

import type { Ability } from '../../../combat/abilities/types'

export const myruVos: Ability = {
  key: 'MYRU_VOS',
  name: 'Myru Vos',
  icon: firmamentIcon,
  category: 'AGENT',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed('SPACE_CANNON', 'MYRU_VOS')
      },
    },
  ],
}
