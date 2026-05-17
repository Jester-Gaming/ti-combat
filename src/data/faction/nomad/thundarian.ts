import nomadIcon from '@/assets/faction/nomad.svg?raw'

import type { Ability } from '../../../combat/abilities-engine/types'
import {
  buildCombatDiceRollGroup,
  buildUnitAbilityDiceRollGroup,
} from '../../../combat/combat-state'

export const thundarian: Ability = {
  key: 'THUNDARIAN',
  name: 'The Thundarian',
  description:
    'After the "Roll Dice" step of combat: You may exhaust this card. If you do, hits are not assigned to either player\'s units. Return to the start of this combat round\'s "Roll Dice" step.',
  icon: nomadIcon,
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'AFTER_DICE_ROLL_STEP',
      isCallable: params => params.isEnabled && params.uses > 0,
      call: ctx => {
        const group = ctx.currentDiceRollIsUnitAbility
          ? buildUnitAbilityDiceRollGroup({
              phase: ctx.currentDiceRollPhase,
              firing: ctx.currentDiceRollFiring,
              hitSource: ctx.currentDiceRollHitSource,
              routing: ctx.currentDiceRollRouting,
            })
          : buildCombatDiceRollGroup({ phase: ctx.currentDiceRollPhase })
        ctx.api.own.discardCurrentGroupScript()
        ctx.api.own.pushSteps([group])
        ctx.logger?.child('THUNDARIAN').child('RESTART').log()
      },
    },
  ],
}
