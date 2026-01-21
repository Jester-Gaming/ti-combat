import { getFactionUnitConfig } from './getFactionUnitConfig';
import {
  type FactionKey,
  type UnitType,
  type UnitStats,
  UNIT_TYPES,
} from '@/types';

/**
 * Returns final computed stats for all units of a faction,
 * merging UPGRADED stats into BASE when unit is upgraded.
 */
export function getFactionUnits(
  factionKey: FactionKey,
  upgrades: Record<UnitType, boolean>
): Record<UnitType, UnitStats> {
  const unitConfig = getFactionUnitConfig(factionKey);
  const result = {} as Record<UnitType, UnitStats>;

  for (const unitType of UNIT_TYPES) {
    const definition = unitConfig[unitType];
    const isUpgraded = upgrades[unitType];

    if (definition.BASE === null) {
      // Unit only has UPGRADED version (like War Sun)
      result[unitType] = definition.UPGRADED ?? {};
    } else if (isUpgraded && definition.UPGRADED) {
      // Merge UPGRADED into BASE
      result[unitType] = mergeUnitStats(definition.BASE, definition.UPGRADED);
    } else {
      // Use BASE stats
      result[unitType] = definition.BASE;
    }
  }

  return result;
}

function mergeUnitStats(
  base: UnitStats,
  upgrade: Partial<UnitStats>
): UnitStats {
  return {
    ...base,
    ...upgrade,
    ABILITIES: {
      ...base.ABILITIES,
      ...upgrade.ABILITIES,
    },
  };
}
