import type { Ability } from '@/combat'

type Params = {
  _useThisRound: boolean
}

declare global {
  interface AbilityConfigMap {
    MUNITIONS_RESERVES: Params
  }
}

export const munitionsReserves: Ability<Params> = {
  key: 'MUNITIONS_RESERVES',
  name: 'Munitions Reserves',
  description:
    'At the start of each round of space combat, you may spend 2 trade goods; you may reroll any number of your dice during that combat round.',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: 0,
    _useThisRound: false,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      call: ctx => {
        ctx.api.own.updateAbilityConfig({ _useThisRound: true })
      },
    },
    {
      timing: 'REROLL_DICE_ROLL',
      system: true,
      isCallable: params => params._useThisRound,
      call: ctx => {
        ctx.api.own.reroll({ target: 'MISSES', consumeUseIf: () => false })
      },
    },
    {
      timing: 'CLEANUP_ROUND',
      system: true,
      isCallable: params => params._useThisRound,
      call: ctx => {
        ctx.api.own.updateAbilityConfig({ _useThisRound: false })
      },
    },
  ],
}
