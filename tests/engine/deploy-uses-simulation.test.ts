import { describe, expect, it } from 'vitest'

import {
  CombatEngine,
  CombatState,
  type CombatStateData,
  getInitialMetaPhase,
  type MetaPhase,
} from '@/combat'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'

import { transitionAndLoad, unitsByBaseType } from '../utils/combat-test'

function countMechs(data: CombatStateData): number {
  return unitsByBaseType(data.attacker).MECH?.length ?? 0
}

/** Drive one step, loading the next phase's script when the stack drains.
 *  Returns the resulting `{ state, meta }`. Mirrors the engine's flow control
 *  but without the cache/round logic — sufficient for tests that just need
 *  deterministic progression. */
function advanceDeterministic(
  state: CombatState,
  round: number,
  meta: MetaPhase,
) {
  let currentMeta = meta
  if (state.pendingSteps.length === 0) {
    state.loadPhaseScript(currentMeta, round)
  }
  const outcomes = state.advance()
  expect(outcomes).toHaveLength(1)
  const next = outcomes[0].state
  if (next.pendingSteps.length === 0 && !next.isFinished()) {
    const nextMeta = transitionAndLoad(next, currentMeta, round)
    if (nextMeta) currentMeta = nextMeta
  }
  return { state: next, meta: currentMeta }
}

/** Drive step-atomic advance() past the combat round's START_OF_COMBAT*
 *  timings and `_postStartOfCombatRound`, stopping before the combat dice
 *  roll (`_doCombatDiceRoll`). */
function advancePastStartOfCombat(
  state: CombatState,
  round: number,
  meta: MetaPhase,
) {
  let s = state
  if (s.pendingSteps.length === 0) s.loadPhaseScript(meta, round)
  while (true) {
    const top = s.peekStep()
    if (top && top.kind === 'method' && top.fn.name === '_doCombatDiceRoll') {
      break
    }
    const outcomes = s.advance()
    if (outcomes.length !== 1 || outcomes[0].probability !== 1) break
    s = outcomes[0].state
  }
  return s
}

describe('DEPLOY uses limit in simulation', () => {
  it('deploy respects uses=2 across full simulation', () => {
    const combatState = buildCombatState({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 10 },
        abilities: { DUNLAIN_REAPER: { uses: 2 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 10 },
      },
    })

    const engine = new CombatEngine()
    const outcomes = engine.simulate(combatState)

    // No outcome should have more than 2 mechs
    for (const outcome of outcomes) {
      const mechCount = outcome.attacker.MECH?.length ?? 0
      expect(mechCount).toBeLessThanOrEqual(2)
    }
  })

  it('deploy invoke registered once', () => {
    const combatState = buildCombatState({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 10 },
        abilities: { DUNLAIN_REAPER: { uses: 2 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 10 },
      },
    })

    // Check invokes for START_OF_COMBAT_ROUND. DUNLAIN_REAPER is a GROUND-mode
    // ability with no `invoke.context`, replicated into every phase bucket —
    // read from GROUND_COMBAT which is the active phase for ground setups.
    const attackerInvokes =
      combatState._invokes.attacker
        .get('GROUND_COMBAT')
        ?.get('START_OF_COMBAT_ROUND') ?? []
    const reaperInvokes = attackerInvokes.filter(
      e => e.ability.key === 'DUNLAIN_REAPER',
    )
    expect(reaperInvokes).toHaveLength(1)
    expect(reaperInvokes[0].source.type).toBe('deploy')
    expect(reaperInvokes[0].params.uses).toBe(2)

    // Check config has the uses value
    expect(combatState.data.attacker.abilities['DUNLAIN_REAPER']?.uses).toBe(2)
  })

  it('uses decrements through simulation advance path', () => {
    const initialState = buildCombatState({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 10 },
        abilities: { DUNLAIN_REAPER: { uses: 2 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 10 },
      },
    })

    // Advance through BOMBARDMENT, SCD, COMMIT_UNITS to GROUND_COMBAT/START
    let state = initialState
    let meta: MetaPhase = getInitialMetaPhase(state.combatMode)
    while (meta !== 'GROUND_COMBAT') {
      ;({ state, meta } = advanceDeterministic(state, 0, meta))
    }

    // GROUND_COMBAT start block — deploy fires in START_OF_COMBAT. Drive
    // through START + START_OF_COMBAT + _postStartOfCombatRound so the
    // deploy abilities resolve before we inspect state.
    state = advancePastStartOfCombat(state, 0, meta)
    expect(countMechs(state.data)).toBe(1) // 1 mech deployed
    const usesAfterRound1 =
      state.data.attacker.liveAbilities['DUNLAIN_REAPER']?.uses ??
      state.data.attacker.abilities['DUNLAIN_REAPER']?.uses
    expect(usesAfterRound1).toBe(1) // uses decremented
  })
})
