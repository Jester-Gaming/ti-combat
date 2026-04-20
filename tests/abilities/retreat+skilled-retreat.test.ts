import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('RETREAT + SKILLED_RETREAT', () => {
  it('skilled retreat takes priority over retreat in same round', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: {
          RETREAT: { isEnabled: true, rounds: 2 },
          SKILLED_RETREAT: { isEnabled: true, rounds: 2 },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound() // round 1
    t.advanceRound() // round 2 — Skilled Retreat fires at START, skips rest

    expect(t.state.currentPhase.meta).toBe('COMPLETE')
    // Skilled Retreat fires at START_OF_COMBAT_ROUND (before RETREAT timing)
    // → transitionTo('COMPLETE', 'DRAW') sets winnerOverride
    expect(t.state.winnerOverride).toBe('draw')
    // Units stay in combat (not retreated via retreatUnits)
    expect(t.attacker.units.CRUISER).toHaveLength(3)
  })
})
