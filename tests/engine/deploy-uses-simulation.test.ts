import { describe, expect, it } from 'vitest'

import { CombatEngine, CombatState, type CombatStateData } from '@/combat'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'

function countMechs(data: CombatStateData): number {
  return data.attacker.units['MECH']?.length ?? 0
}

function advanceDeterministic(state: CombatState, round: number) {
  const outcomes = state.advance(round)
  expect(outcomes).toHaveLength(1)
  return outcomes[0].state
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

    // Check invokes for START_OF_COMBAT_ROUND
    const attackerInvokes =
      combatState._invokes.attacker.get('START_OF_COMBAT_ROUND') ?? []
    const reaperInvokes = attackerInvokes.filter(
      e => e.ability.key === 'DUNLAIN_REAPER',
    )
    expect(reaperInvokes).toHaveLength(1)
    expect(reaperInvokes[0].source.type).toBe('deploy')
    expect(reaperInvokes[0].params.uses).toBe(2)

    // Check config has the uses value
    expect(combatState.data.abilities.attacker['DUNLAIN_REAPER']?.uses).toBe(2)
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
    while (state.data.currentPhase.meta !== 'GROUND_COMBAT') {
      state = advanceDeterministic(state, 0)
    }
    expect(state.data.currentPhase.micro).toBe('START')

    // GROUND_COMBAT/START — deploy fires here
    state = advanceDeterministic(state, 0)
    expect(countMechs(state.data)).toBe(1) // 1 mech deployed
    const usesAfterRound1 =
      state.data.abilities.attacker['DUNLAIN_REAPER']?.uses
    expect(usesAfterRound1).toBe(1) // uses decremented
  })
})
