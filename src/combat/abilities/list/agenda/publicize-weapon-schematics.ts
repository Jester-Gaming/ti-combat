import type { SideState } from '../../../state/types'
import type { Ability, AbilityReadContext, StateChange } from '../../types'

type Params = {
  isEnabled: boolean
}

/** Remove SUSTAIN_DAMAGE from all War Suns in a side's units */
function modifyWarSuns(units: SideState['units']): SideState['units'] {
  const warSuns = units.WAR_SUN
  if (!warSuns || warSuns.length === 0) {
    return units
  }

  const modifiedWarSuns = warSuns.map(unit => {
    if (!unit.UNIT_ABILITIES?.SUSTAIN_DAMAGE) {
      return unit
    }

    const newAbilities = { ...unit.UNIT_ABILITIES }
    delete newAbilities.SUSTAIN_DAMAGE

    return {
      ...unit,
      UNIT_ABILITIES: newAbilities,
    }
  })

  return {
    ...units,
    WAR_SUN: modifiedWarSuns,
  }
}

export const publicizeWeaponSchematics: Ability<Params> = {
  key: 'PUBLICIZE_WEAPON_SCHEMATICS',
  name: 'Publicize Weapon Schematics',
  category: 'AGENDA',
  defaultParams: {
    isEnabled: false,
  },
  condition: {
    onlyDefender: true,
  },
  enableUI: true,
  invoke: [
    {
      timing: 'SETUP',
      isCallable: (_ctx: AbilityReadContext, params: Params) =>
        params.isEnabled,
      call: (ctx: AbilityReadContext): StateChange<void> => {
        return {
          state: {
            ...ctx.state,
            attacker: {
              ...ctx.state.attacker,
              units: modifyWarSuns(ctx.state.attacker.units),
            },
            defender: {
              ...ctx.state.defender,
              units: modifyWarSuns(ctx.state.defender.units),
            },
          },
        }
      },
    },
  ],
}
