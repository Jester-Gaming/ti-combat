import type {
  Ability,
  AbilityReadContext,
  DiceData,
  StateChange,
} from '@/combat/abilities/types'
import type { MetaPhase } from '@/combat/state/types'
import { UNIT_ABILITY_PHASES } from '@/combat/state/types'
import type { DieValue } from '@/types'

type Params = {
  isEnabled: boolean
  phases: MetaPhase[]
}

export const trrakanAunZulok: Ability<Params> = {
  key: 'TRRAKAN_AUN_ZULOK',
  name: '(Argent) Trrakan Aun Zulok',
  category: 'COMMANDER',
  enableUI: true,
  defaultParams: {
    isEnabled: false,
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
        { label: 'Space Cannon Defense', value: 'SPACE_CANNON_DEFENSE' },
      ],
    },
  ],
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: UNIT_ABILITY_PHASES,
      isCallable: (
        ctx: AbilityReadContext,
        params: Params,
        diceData: DiceData,
      ) => {
        if (!params.isEnabled || diceData.own.length === 0) return false
        const currentPhase = ctx.state.currentPhase.meta
        return params.phases.includes(currentPhase)
      },
      call: (
        ctx: AbilityReadContext,
        _params: Params,
        diceData: DiceData,
      ): StateChange<DiceData> => {
        // Find the die with the lowest hit value (best chance to hit)
        let targetIndex = 0
        let targetHitValue = diceData.own[0][0]
        for (let i = 1; i < diceData.own.length; i++) {
          if (diceData.own[i][0] < targetHitValue) {
            targetHitValue = diceData.own[i][0]
            targetIndex = i
          }
        }

        // Add 1 additional die to the target entry
        const modifiedDice = diceData.own.map((die, i) => {
          if (i === targetIndex) {
            return [die[0], die[1] + 1, die[2]] as DieValue
          }
          return die
        })

        return {
          state: ctx.state,
          context: {
            own: modifiedDice,
            opponent: diceData.opponent,
          },
        }
      },
    },
  ],
}
