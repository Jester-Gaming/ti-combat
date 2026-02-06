import type { Ability } from '@/combat/abilities/types'
import type { MetaPhase } from '@/combat/combat-state/types'
import { UNIT_ABILITY_PHASES } from '@/combat/combat-state/types'

type Params = {
  phases: MetaPhase[]
}

export const trrakanAunZulok: Ability<Params> = {
  key: 'TRRAKAN_AUN_ZULOK',
  name: '(Argent) Trrakan Aun Zulok',
  category: 'COMMANDER',
  headerUI: 'isEnabled',
  params: {
    isEnabled: false,
    uses: Infinity,
    phases: [...UNIT_ABILITY_PHASES],
  },
  uiConfig: [
    {
      type: 'checkbox-list',
      key: 'phases',
      label: 'Abilities',
      items: [
        { label: 'Anti-Fighter Barrage', value: 'AFB' },
        { label: 'Space Cannon Offense', value: 'SPACE_CANNON_OFFENSE' },
        { label: 'Bombardment', value: 'BOMBARDMENT' },
        {
          label: 'Space Cannon Defense',
          value: 'SPACE_CANNON_DEFENSE',
        },
      ],
    },
  ],
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: UNIT_ABILITY_PHASES,
      isCallable: (params, ctx, dice) => {
        if (dice.own.isEmpty()) return false
        const currentPhase = ctx.state.currentPhase.meta
        return params.phases.includes(currentPhase)
      },
      call: (_ctx, _params, dice) => {
        dice.own.addDiceCount(1)
      },
    },
  ],
}
