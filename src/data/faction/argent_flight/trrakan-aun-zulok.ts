import { z } from 'zod/mini'

import argentFlightIcon from '@/assets/faction/argent_flight.svg?raw'
import { type Ability, type MetaPhase, UNIT_ABILITY_PHASES } from '@/combat'

type Params = {
  phases: MetaPhase[]
}

export const trrakanAunZulok: Ability<Params> = {
  key: 'TRRAKAN_AUN_ZULOK',
  name: 'Trrakan Aun Zulok',
  icon: argentFlightIcon,
  category: 'COMMANDER',
  headerUI: 'isEnabled',
  paramsSchema: z.object({ phases: z.array(z.string()) }),
  params: {
    isEnabled: false,
    uses: Infinity,
    phases: [...UNIT_ABILITY_PHASES],
  },
  uiConfig: [
    {
      type: 'checkbox-list',
      key: 'phases',
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
