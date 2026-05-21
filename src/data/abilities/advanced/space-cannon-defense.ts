import type { Ability } from '@/combat'

type Params = { disableSustainDamage: boolean }

declare global {
  interface AbilityConfigMap {
    SPACE_CANNON_DEFENSE: Params
  }
}

export const spaceCannonDefense: Ability<Params> = {
  key: 'SPACE_CANNON_DEFENSE',
  name: 'Space Cannon Defense',
  description: 'Space Cannon Defense is resolved only when enabled',
  side: 'defender',
  params: {
    isEnabled: true,
    uses: Infinity,
    disableSustainDamage: false,
  },
  headerUI: 'isEnabled',
  uiConfig: [
    {
      key: 'disableSustainDamage',
      label: 'Disable Sustain Damage',
      type: 'checkbox',
    },
  ],
  invoke: [
    {
      timing: 'SPACE_CANNON_DEFENSE_STEP',
      call: (ctx, params) =>
        ctx.resolveStep('SPACE_CANNON_DEFENSE', {
          abilitiesOverride: params.disableSustainDamage
            ? { SUSTAIN_DAMAGE: false }
            : undefined,
        }),
    },
  ],
}
