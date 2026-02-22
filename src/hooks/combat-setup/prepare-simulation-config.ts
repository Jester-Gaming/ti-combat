import { getAvailableAbilities } from '@/combat/abilities-engine'
import type { AbilitiesConfig, CombatMode } from '@/combat/combat-state/types'
import type { FactionKey } from '@/types'

import {
  reconcileAbilitiesConfig,
  resetSettingsToBase,
  restoreConsumerParams,
  snapshotConsumerParams,
} from './reconcile'

/**
 * Prepare abilities config for simulation.
 *
 * Runs the full reconcile pipeline (snapshot user params → reconcile →
 * restore user selections → reset SETTINGS to base), producing a config
 * ready for AbilitiesEngine with no further reconciliation needed.
 */
export function prepareSimulationConfig(
  config: AbilitiesConfig,
  attackerFaction: FactionKey,
  defenderFaction: FactionKey,
  combatMode: CombatMode,
): void {
  const abilities = {
    attacker: getAvailableAbilities('attacker', attackerFaction),
    defender: getAvailableAbilities('defender', defenderFaction),
  }

  const savedParams = snapshotConsumerParams(config, abilities)
  reconcileAbilitiesConfig(config, abilities, combatMode)
  restoreConsumerParams(config, abilities, savedParams)
  resetSettingsToBase(config, abilities)
}
