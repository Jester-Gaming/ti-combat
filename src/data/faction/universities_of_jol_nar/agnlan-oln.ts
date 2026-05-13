import universitiesOfJolNarIcon from '@/assets/faction/universities_of_jol_nar.svg?raw'
import type { Ability } from '@/combat'
import {
  buildRerollStrategy,
  type RerollStrategy,
  rerollStrategyConfig,
  strategyToPredicate,
} from '@/combat/reroll'

type Params = {
  ownStrategyKind: RerollStrategy['kind']
  ownStrategyThreshold: number
}

declare global {
  interface AbilityConfigMap {
    AGNLAN_OLN: Params
  }
}

export const agnlanOln: Ability<Params> = {
  key: 'AGNLAN_OLN',
  name: 'Agnlan Oln',
  description:
    'After you roll dice for a unit ability: You may reroll any of those dice.',
  icon: universitiesOfJolNarIcon,
  params: {
    isEnabled: false,
    uses: Infinity,
    ownStrategyKind: 'ALWAYS',
    ownStrategyThreshold: 0,
  },
  headerUI: 'isEnabled',
  uiConfig: (_ctx, params) =>
    rerollStrategyConfig<Params>(
      'ownStrategyKind',
      'ownStrategyThreshold',
      params.ownStrategyKind,
      'Own dice',
    ),
  invoke: [
    {
      timing: 'REROLL_UNIT_ABILITY_ROLL',
      isCallable: params => params.ownStrategyKind !== 'NEVER',
      call: (ctx, params) => {
        const strategy = buildRerollStrategy(
          params.ownStrategyKind,
          params.ownStrategyThreshold,
        )
        ctx.api.own.reroll({
          target: 'MISSES',
          rerollIf: strategyToPredicate(strategy),
          consumeUseIf: () => false,
        })
      },
    },
  ],
}
