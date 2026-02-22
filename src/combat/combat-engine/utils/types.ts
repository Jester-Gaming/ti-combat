import type { UnitBaseType } from '@/types'

import type { SideStateData } from '../../combat-state/types'

/**
 * Outcome with probability relative to reaching the node.
 * Stores compact state references instead of extracted survivors —
 * extraction is deferred to outcomeRecordToArray (once per unique outcome).
 */
export interface RelativeOutcome {
  attackerData: SideStateData
  defenderData: SideStateData
  attackerParticipating: ReadonlySet<UnitBaseType>
  defenderParticipating: ReadonlySet<UnitBaseType>
  probability: number
}

export type OutcomeRecord = Map<string, RelativeOutcome>
