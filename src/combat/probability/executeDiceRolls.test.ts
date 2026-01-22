import { describe, it, expect } from 'vitest'
import { executeDiceRolls } from './executeDiceRolls'
import type { CombatState } from '../types'
import type { DieValue } from '@/types'

const makeState = (): CombatState => ({
  attacker: { stats: {}, units: {}, pendingHits: 0 },
  defender: { stats: {}, units: {}, pendingHits: 0 },
})

describe('executeDiceRolls', () => {
  it('creates nodes for both sides rolling', () => {
    const state = makeState()
    // 1 die at 9+ (20% hit chance)
    const attackerDice: DieValue[] = [[9, 1]]
    const defenderDice: DieValue[] = [[9, 1]]

    const nodes = executeDiceRolls(state, attackerDice, defenderDice)

    // 4 outcomes: both miss, attacker hits, defender hits, both hit
    expect(nodes).toHaveLength(4)
  })

  it('assigns attacker hits to defender pending hits', () => {
    const state = makeState()
    // 1 die at 1+ (100% hit chance)
    const attackerDice: DieValue[] = [[1, 1]]
    const defenderDice: DieValue[] = []

    const nodes = executeDiceRolls(state, attackerDice, defenderDice)

    expect(nodes).toHaveLength(1)
    expect(nodes[0].state.defender.pendingHits).toBe(1)
    expect(nodes[0].state.attacker.pendingHits).toBe(0)
  })

  it('assigns defender hits to attacker pending hits', () => {
    const state = makeState()
    const attackerDice: DieValue[] = []
    // 1 die at 1+ (100% hit chance)
    const defenderDice: DieValue[] = [[1, 1]]

    const nodes = executeDiceRolls(state, attackerDice, defenderDice)

    expect(nodes).toHaveLength(1)
    expect(nodes[0].state.attacker.pendingHits).toBe(1)
    expect(nodes[0].state.defender.pendingHits).toBe(0)
  })

  it('probabilities sum to 1', () => {
    const state = makeState()
    const attackerDice: DieValue[] = [[9, 2]]
    const defenderDice: DieValue[] = [[7, 1]]

    const nodes = executeDiceRolls(state, attackerDice, defenderDice)

    const totalProb = nodes.reduce((sum, n) => sum + n.probability, 0)
    expect(totalProb).toBeCloseTo(1.0)
  })

  it('handles empty dice lists', () => {
    const state = makeState()

    const nodes = executeDiceRolls(state, [], [])

    expect(nodes).toHaveLength(1)
    expect(nodes[0].probability).toBe(1)
    expect(nodes[0].state.attacker.pendingHits).toBe(0)
    expect(nodes[0].state.defender.pendingHits).toBe(0)
  })
})
