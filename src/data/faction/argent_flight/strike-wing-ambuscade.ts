import { z } from 'zod/mini'

import argentFlightIcon from '@/assets/faction/argent_flight.svg?raw'
import { type Ability, type MetaPhase, UNIT_ABILITY_PHASES } from '@/combat'

type Params = {
  phases: MetaPhase[]
}

export const strikeWingAmbuscade: Ability<Params> = {
  key: 'STRIKE_WING_AMBUSCADE',
  name: 'Strike Wing Ambuscade',
  description:
    'When 1 or more of your units make a roll for a unit ability: Choose 1 of those units to roll 1 additional die. Then, return this card to the Argent player.',
  icon: argentFlightIcon,
  category: 'PROMISSORY',
  headerUI: 'isEnabled',
  paramsSchema: z.object({ phases: z.array(z.string()) }),
  params: {
    isEnabled: false,
    uses: 1,
    phases: [...UNIT_ABILITY_PHASES],
  },
  uiConfig: [
    {
      type: 'number',
      key: 'uses',
      label: 'Usages',
      min: 0,
    },
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
      isCallable: (params, ctx) => {
        if (ctx.api.own.isDicePoolEmpty()) return false
        return params.phases.includes(ctx.meta)
      },
      call: ctx => {
        ctx.api.own.addDiceCount(1)
      },
    },
  ],
}
