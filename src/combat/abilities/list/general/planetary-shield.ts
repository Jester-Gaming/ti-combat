import type { UnitType } from '@/types'

import type { Ability, AbilityReadContext, SideReadApi } from '../../types'

/** Check if any unit on the side has an active Planetary Shield */
function hasPlanetaryShield(api: SideReadApi): boolean {
  const units = api.getUnits()
  for (const [type, typeUnits] of Object.entries(units)) {
    if (!typeUnits || typeUnits.length === 0) continue
    const unitType = type as UnitType

    if (
      api.isUnitAbilityLost('PLANETARY_SHIELD', unitType) ||
      api.isUnitAbilityCannotBeUsed('PLANETARY_SHIELD', unitType)
    ) {
      continue
    }

    if (typeUnits.some(u => u.UNIT_ABILITIES?.PLANETARY_SHIELD)) {
      return true
    }
  }
  return false
}

export const planetaryShield: Ability = {
  key: 'PLANETARY_SHIELD',
  name: 'Planetary Shield',
  category: 'GENERAL',
  condition: { onlyDefender: true },
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: (_params: Record<string, unknown>, ctx: AbilityReadContext) =>
        hasPlanetaryShield(ctx.api.own),
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed(
          'BOMBARDMENT',
          'PLANETARY_SHIELD',
        )
      },
    },
  ],
}
