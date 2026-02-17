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
      // Eidolon Maximum is immune to SCO/AFB — if an ability (e.g. Waylay)
      // expands targets to include MECH, remove it. Uses isCallable to
      // defer until after the expanding ability fires (alternating resolution).
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: ['AFB', 'SPACE_CANNON_OFFENSE'],
      isCallable: (_params, ctx) => {
        const settings = ctx.api.own.getAbilityConfig('SETTINGS')
        const afb =
          (settings?.validTargetsAntiFighterBarrage as UnitType[]) ?? []
        const sco =
          (settings?.validTargetsSpaceCannonOffense as UnitType[]) ?? []
        return afb.includes('MECH') || sco.includes('MECH')
      },
      call: ctx => {
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          validTargetsAntiFighterBarrage: (current: UnitType[]) =>
            current.filter(u => u !== 'MECH'),
          validTargetsSpaceCannonOffense: (current: UnitType[]) =>
            current.filter(u => u !== 'MECH'),
        })
      },
    },
    {
      timing: 'START_OF_COMBAT_ROUND',
      call: ctx => {
        // Restore MECH to groundForces for ground combat participation
        // (bombardment/SCD are done by this point)
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          groundForces: (current: UnitType[]) =>
            current.includes('MECH') ? current : [...current, 'MECH'],
        })

        // Repair damaged mechs at start of each round
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
