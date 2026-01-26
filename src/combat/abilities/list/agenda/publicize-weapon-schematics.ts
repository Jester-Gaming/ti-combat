import type { Ability, AbilityReadContext, StateChange } from '../../types'

type Params = {
  isEnabled: boolean
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
        const newState = { ...ctx.state }

        // Remove SUSTAIN_DAMAGE from all War Suns on both sides
        const modifyWarSuns = (
          units: typeof ctx.state.attacker.units,
        ): typeof ctx.state.attacker.units => {
          const warSuns = units.WAR_SUN
          if (!warSuns || warSuns.length === 0) {
            return units
          }

          const modifiedWarSuns = warSuns.map(unit => {
            if (!unit.UNIT_ABILITIES?.SUSTAIN_DAMAGE) {
              return unit
            }

            // Remove SUSTAIN_DAMAGE from the unit's abilities
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

        newState.attacker = {
          ...ctx.state.attacker,
          units: modifyWarSuns(ctx.state.attacker.units),
        }

        newState.defender = {
          ...ctx.state.defender,
          units: modifyWarSuns(ctx.state.defender.units),
        }

        return { state: newState }
      },
    },
  ],
}
