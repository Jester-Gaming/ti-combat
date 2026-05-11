import baronyOfLetnevIcon from '@/assets/faction/barony_of_letnev.svg?raw'
import type { Ability } from '@/combat'
import { type RerollStrategy, strategyToPredicate } from '@/combat/reroll'

type Params = {
  ownStrategy: RerollStrategy
  opponentStrategy: RerollStrategy
}

declare global {
  interface AbilityConfigMap {
    WAR_FUNDING: Params
  }
}

export const warFunding: Ability<Params> = {
  key: 'WAR_FUNDING',
  name: 'War Funding',
  description:
    "After you and your opponent roll dice during a space combat: You may reroll all of your opponent's dice. You may reroll any number of your dice. Then, return this card to the Letnev player.",
  icon: baronyOfLetnevIcon,
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
    ownStrategy: { kind: 'ALWAYS' },
    opponentStrategy: { kind: 'NEVER' },
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'REROLL_DICE_ROLL',
      isCallable: params =>
        params.ownStrategy.kind !== 'NEVER' ||
        params.opponentStrategy.kind !== 'NEVER',
      call: (ctx, params) => {
        if (params.ownStrategy.kind !== 'NEVER') {
          ctx.api.own.reroll({
            target: 'MISSES',
            rerollIf: strategyToPredicate(params.ownStrategy, 'own'),
          })
        }
        if (params.opponentStrategy.kind !== 'NEVER') {
          ctx.api.opponent.reroll({
            target: 'ALL',
            rerollIf: strategyToPredicate(params.opponentStrategy, 'opponent'),
          })
        }
      },
    },
  ],
}
