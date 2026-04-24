import type { CombatSide, FactionKey } from '@/types'

import type { Ability } from '../../combat/abilities-engine/types'
import type {
  CombatMode,
  SideAbilitiesConfig,
} from '../../combat/combat-state/types'
import {
  getAvailableAbilities,
  getFactionOwnedAbilityKeys,
  getUnitDefinitionAbilityKeys,
} from './get-available-abilities'
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
 *
 * Returns the computed abilities so callers can pass them to CombatState
 * factories (avoiding a redundant second call to getAvailableAbilities).
 */
interface SideAbilitiesData {
  abilities: Ability[]
  unitAbilityKeys: ReadonlySet<string>
  factionOwnedKeys: ReadonlySet<string>
}

export function prepareSimulationConfig(
  config: Record<CombatSide, SideAbilitiesConfig>,
  attackerFaction: FactionKey,
  defenderFaction: FactionKey,
  combatMode: CombatMode,
  customAbilities?: Ability[],
): Record<CombatSide, SideAbilitiesData> {
  const custom = customAbilities ?? []
  const abilities = {
    attacker: [
      ...getAvailableAbilities('attacker', attackerFaction),
      ...custom,
    ],
    defender: [
      ...getAvailableAbilities('defender', defenderFaction),
      ...custom,
    ],
  }

  const savedParams = snapshotConsumerParams(config, abilities)
  reconcileAbilitiesConfig(config, abilities, combatMode)
  restoreConsumerParams(config, abilities, savedParams)
  resetSettingsToBase(config, abilities)

  return {
    attacker: {
      abilities: abilities.attacker,
      unitAbilityKeys: getUnitDefinitionAbilityKeys(attackerFaction),
      factionOwnedKeys: getFactionOwnedAbilityKeys(attackerFaction),
    },
    defender: {
      abilities: abilities.defender,
      unitAbilityKeys: getUnitDefinitionAbilityKeys(defenderFaction),
      factionOwnedKeys: getFactionOwnedAbilityKeys(defenderFaction),
    },
  }
}
