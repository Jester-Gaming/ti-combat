import argentFlightIcon from '@/assets/faction/argent_flight.svg?raw'
import type { Ability } from '@/combat/abilities/types'
import type { MetaPhase } from '@/combat/combat-state/types'
import { UNIT_ABILITY_PHASES } from '@/combat/combat-state/types'

type Params = {
  phases: MetaPhase[]
}

export const strikeWingAmbuscade: Ability<Params> = {
  key: 'STRIKE_WING_AMBUSCADE',
  name: 'Strike Wing Ambuscade',
  icon: argentFlightIcon,
  category: 'PROMISSORY',
  headerUI: 'isEnabled',
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
