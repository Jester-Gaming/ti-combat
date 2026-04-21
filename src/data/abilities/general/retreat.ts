import type { CombatSide, UnitId, UnitState, UnitType } from '@/types'

import type {
  Ability,
  AbilityCallContext,
} from '../../../combat/abilities-engine/types'
import type { CombatStateData } from '../../../combat/combat-state/types'

type Params = {
  isEnabled: boolean
  rounds: number
  _currentRound: number
  _saved?: SavedRetreatData
}

declare global {
  interface TimingContextMap {
    ANNOUNCE_RETREAT: void
    WHEN_RETREAT: UnitId
  }
}

// ---------------------------------------------------------------------------
// Shared retreat helpers — used by RETREAT, WATCHFUL_OJZ, etc.
// ---------------------------------------------------------------------------

export interface SavedRetreatData {
  savedUnits: Record<string, number[]>
  savedUnitState: Record<number, UnitState>
}

/** Remove units from combat and save them into RETREAT's config for
 *  restoration at CLEANUP. Can be called by any ability (e.g. Ojz). */
export function retreatUnits(ctx: AbilityCallContext, unitIds: UnitId[]): void {
  const side = ctx.state[ctx.side]
  const retreatConfig = ctx.state.abilities[ctx.side]['RETREAT'] as
    | Record<string, unknown>
    | undefined
  const existing = (retreatConfig?._saved as SavedRetreatData | undefined) ?? {
    savedUnits: {},
    savedUnitState: {},
  }

  // Build merged saved data (new objects to avoid shared-reference mutation)
  const mergedUnits = { ...existing.savedUnits }
  const mergedState = { ...existing.savedUnitState }

  for (const unitId of unitIds) {
    const variantKey = ctx.api.own.getVariantKey(unitId)
    if (!variantKey) continue

    mergedUnits[variantKey] = [
      ...(mergedUnits[variantKey] ?? []),
      unitId as unknown as number,
    ]

    const us = side.unitState[unitId]
    if (us) mergedState[unitId as unknown as number] = { ...us }
  }

  // Trigger WHEN_RETREAT for each unit before removal
  for (const unitId of unitIds) {
    ctx.trigger('WHEN_RETREAT', unitId)
  }

  ctx.api.own.removeUnits(unitIds)

  // Store in RETREAT's config (not the calling ability's config)
  ctx.api.own.updateAbilityConfig('RETREAT', {
    _saved: { savedUnits: mergedUnits, savedUnitState: mergedState },
  })
}

/** Restore previously retreated units back into the combat state.
 *  Creates new objects/arrays to avoid mutating shared references
 *  across probability branches. */
export function restoreRetreatedUnits(
  state: CombatStateData,
  side: CombatSide,
  saved: SavedRetreatData,
): void {
  const sideState = state[side]

  const newUnits = { ...sideState.units }
  for (const [key, ids] of Object.entries(saved.savedUnits)) {
    const typedKey = key as UnitType
    const restoredIds = ids as unknown as UnitId[]
    newUnits[typedKey] = newUnits[typedKey]
      ? [...newUnits[typedKey], ...restoredIds]
      : [...restoredIds]
  }
  sideState.units = newUnits

  sideState.unitState = { ...sideState.unitState }
  for (const [id, us] of Object.entries(saved.savedUnitState)) {
    sideState.unitState[Number(id) as UnitId] = us as UnitState
  }
}

// ---------------------------------------------------------------------------
// RETREAT ability
// ---------------------------------------------------------------------------

export const retreat: Ability<Params> = {
  key: 'RETREAT',
  name: 'Retreat',
  category: 'GENERAL',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
    rounds: 1,
    _currentRound: 1,
  },
  headerUI: 'isEnabled',
  uiConfig: [
    { key: 'rounds', label: 'In round', type: 'number', min: 1, max: 99 },
  ],
  invoke: [
    {
      timing: 'ANNOUNCE_RETREAT_STEP',
      isCallable: params => params._currentRound >= params.rounds,
      call: ctx => {
        ctx.trigger('ANNOUNCE_RETREAT', undefined)
      },
    },
    {
      timing: 'RETREAT_STEP',
      isCallable: params => params._currentRound >= params.rounds,
      call: ctx => {
        const allIds: UnitId[] = []
        for (const type of ctx.api.own.getActiveBaseTypes()) {
          allIds.push(...ctx.api.own.getUnits(type, { includeVariants: true }))
        }

        ctx.transitionTo('COMPLETE', 'LOST')
        retreatUnits(ctx, allIds)
      },
    },
    {
      timing: 'CLEANUP_ROUND',
      call: (ctx, params) => {
        ctx.api.own.updateAbilityConfig({
          _currentRound: params._currentRound + 1,
        })
      },
    },
  ],
}
