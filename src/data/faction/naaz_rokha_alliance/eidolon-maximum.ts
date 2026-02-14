import type { Ability } from '@/combat/abilities/types'
import type { UnitType } from '@/types'

export const eidolonMaximum: Ability = {
  key: 'EIDOLON_MAXIMUM',
  name: 'Eidolon Maximum',
  category: 'FACTION',
  subcategory: 'BREAKTHROUGH',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  declareParamChange: () => [{ key: 'ships', value: 'MECH' }],
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        // Disable base Eidolon ability (prevent Z-Grav transform)
        ctx.api.own.updateAbilityConfig('EIDOLON', { isEnabled: false })

        ctx.api.own.updateAbilityConfig('SETTINGS', {
          // Add MECH to ships for space combat participation
          ships: (current: UnitType[]) =>
            current.includes('MECH') ? current : [...current, 'MECH'],
          // Remove MECH from groundForces so derived valid targets
          // (bombardment, SCD) exclude it — unit ability hit immunity
          groundForces: (current: UnitType[]) =>
            current.filter(u => u !== 'MECH'),
        })

        // Modify all mechs to Eidolon Maximum form: combat [4, 4]
        const mechs = ctx.api.own.getUnits('MECH')
        for (const mech of mechs) {
          ctx.api.own.modifyUnit(mech, { COMBAT: [4, 4] })
        }
      },
    },
    {
      // Restore MECH to groundForces after unit ability phases
      // (bombardment/SCD) are done, before ground combat participation
      timing: 'START_OF_COMBAT',
      call: ctx => {
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          groundForces: (current: UnitType[]) =>
            current.includes('MECH') ? current : [...current, 'MECH'],
        })
      },
    },
    {
      timing: 'START_OF_COMBAT_ROUND',
      isCallable: (_params, ctx) => {
        return ctx.api.own.getUnits('MECH').some(m => m.isDamaged)
      },
      call: ctx => {
        const mechs = ctx.api.own.getUnits('MECH')
        for (const mech of mechs) {
          if (mech.isDamaged) {
            ctx.api.own.modifyUnit(mech, { isDamaged: false })
          }
        }
      },
    },
  ],
}
