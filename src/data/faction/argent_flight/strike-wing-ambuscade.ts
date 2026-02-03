import type {
  Ability,
  AbilityReadContext,
  DiceContext,
  DiceReadContext,
} from '@/combat/abilities/types'
import type { MetaPhase } from '@/combat/combat-state/types'
import { UNIT_ABILITY_PHASES } from '@/combat/combat-state/types'

type Params = {
  isEnabled: boolean
  uses: number
  phases: MetaPhase[]
}

export const strikeWingAmbuscade: Ability<Params> = {
  key: 'STRIKE_WING_AMBUSCADE',
  name: '(Argent) Strike Wing Ambuscade',
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
      isCallable: (
        params: Params,
        ctx: AbilityReadContext,
        dice: DiceReadContext,
      ) => {
        if (!params.isEnabled || params.uses <= 0 || dice.own.isEmpty())
          return false
        const currentPhase = ctx.state.currentPhase.meta
        return params.phases.includes(currentPhase)
      },
      call: (ctx, params: Params, dice: DiceContext) => {
        dice.own.addDice(1)
        ctx.api.own.updateAbilityConfig({ uses: params.uses - 1 })
      },
    },
  ],
}
