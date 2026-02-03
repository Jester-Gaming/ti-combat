import type { UnitType } from '@/types'

import type { MetaPhase } from '../../combat-state/types'

export function getSettingsValidTargets(
  params: Record<string, unknown>,
  meta: MetaPhase,
): UnitType[] {
  switch (meta) {
    case 'SPACE_CANNON_OFFENSE':
      return (params.validTargetsSpaceCannonOffense as UnitType[]) ?? []
    case 'AFB':
      return (params.validTargetsAntiFighterBarrage as UnitType[]) ?? []
    case 'BOMBARDMENT':
      return (params.validTargetsBombardment as UnitType[]) ?? []
    case 'SPACE_CANNON_DEFENSE':
      return (params.validTargetsSpaceCannonDefense as UnitType[]) ?? []
    case 'SPACE_COMBAT':
      return (params.spaceCombatParticipating as UnitType[]) ?? []
    case 'GROUND_COMBAT':
      return (params.groundCombatParticipating as UnitType[]) ?? []
    default:
      return []
  }
}
