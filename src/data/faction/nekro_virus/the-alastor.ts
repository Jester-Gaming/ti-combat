import type { Ability } from '@/combat/abilities/types'
import { GROUND_FORCES } from '@/constants/units'
import type { UnitType } from '@/types'

export const theAlastor: Ability = {
  key: 'THE_ALASTOR',
  name: 'The Alastor',
  category: 'FACTION',
  subcategory: 'FLAGSHIP',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  declareParamChange: (_params, settings) =>
    ((settings.groundForces as UnitType[]) ?? GROUND_FORCES).map(u => ({
      key: 'ships',
      value: u,
    })),
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      call: ctx => {
        const settings = ctx.api.own.getAbilityConfig('SETTINGS')
        const groundForces =
          (settings?.groundForces as UnitType[] | undefined) ?? GROUND_FORCES

        ctx.api.own.updateAbilityConfig('SETTINGS', {
          ships: (current: UnitType[]) => [
            ...current,
            ...groundForces.filter(u => !current.includes(u)),
          ],
        })
      },
    },
  ],
}
