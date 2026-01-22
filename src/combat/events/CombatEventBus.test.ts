import { describe, it, expect, vi } from 'vitest'
import { CombatEventBus } from './CombatEventBus'
import type { EventHandler } from './types'
import type { ProbabilityState, CombatState } from '../types'

function createMockState(round: number = 1): CombatState {
  return {
    attacker: { stats: {}, units: {}, pendingHits: 0 },
    defender: { stats: {}, units: {}, pendingHits: 0 },
    round,
  }
}

function createMockProbState(round: number = 1): ProbabilityState {
  return {
    state: createMockState(round),
    probability: 1,
  }
}

describe('CombatEventBus', () => {
  describe('on/emit', () => {
    it('registers and executes handlers', () => {
      const bus = new CombatEventBus()
      const handler: EventHandler = vi.fn(ctx => ({
        states: ctx.states,
      }))

      bus.on('COMBAT_ROLLS', handler)

      const states = [createMockProbState()]
      bus.emit('COMBAT_ROLLS', { states, round: 1 })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ states, round: 1 })
    })

    it('returns unchanged states when no handlers', () => {
      const bus = new CombatEventBus()
      const states = [createMockProbState()]

      const result = bus.emit('COMBAT_ROLLS', { states, round: 1 })

      expect(result.states).toBe(states)
    })

    it('chains handler results through multiple handlers', () => {
      const bus = new CombatEventBus()

      const handler1: EventHandler = ctx => {
        // Transform: add a second state
        return {
          states: [...ctx.states, { ...ctx.states[0], probability: 0.5 }],
        }
      }

      const handler2: EventHandler = ctx => {
        // Transform: modify probabilities
        return {
          states: ctx.states.map(s => ({
            ...s,
            probability: s.probability * 0.5,
          })),
        }
      }

      bus.on('COMBAT_ROLLS', handler1, 0)
      bus.on('COMBAT_ROLLS', handler2, 1)

      const states = [createMockProbState()]
      const result = bus.emit('COMBAT_ROLLS', { states, round: 1 })

      // handler1 adds a state (2 states), handler2 halves probabilities
      expect(result.states).toHaveLength(2)
      expect(result.states[0].probability).toBe(0.5)
      expect(result.states[1].probability).toBe(0.25)
    })
  })

  describe('priority ordering', () => {
    it('executes handlers in ascending priority order', () => {
      const bus = new CombatEventBus()
      const executionOrder: number[] = []

      const handler1: EventHandler = ctx => {
        executionOrder.push(1)
        return { states: ctx.states }
      }

      const handler2: EventHandler = ctx => {
        executionOrder.push(2)
        return { states: ctx.states }
      }

      const handler3: EventHandler = ctx => {
        executionOrder.push(3)
        return { states: ctx.states }
      }

      // Register in reverse priority order
      bus.on('COMBAT_ROLLS', handler3, 30)
      bus.on('COMBAT_ROLLS', handler1, 10)
      bus.on('COMBAT_ROLLS', handler2, 20)

      bus.emit('COMBAT_ROLLS', { states: [createMockProbState()], round: 1 })

      expect(executionOrder).toEqual([1, 2, 3])
    })

    it('uses default priority of 0', () => {
      const bus = new CombatEventBus()
      const executionOrder: string[] = []

      const defaultHandler: EventHandler = ctx => {
        executionOrder.push('default')
        return { states: ctx.states }
      }

      const laterHandler: EventHandler = ctx => {
        executionOrder.push('later')
        return { states: ctx.states }
      }

      bus.on('COMBAT_ROLLS', laterHandler, 10)
      bus.on('COMBAT_ROLLS', defaultHandler) // default priority = 0

      bus.emit('COMBAT_ROLLS', { states: [createMockProbState()], round: 1 })

      expect(executionOrder).toEqual(['default', 'later'])
    })
  })

  describe('off', () => {
    it('removes a registered handler', () => {
      const bus = new CombatEventBus()
      const handler: EventHandler = vi.fn(ctx => ({
        states: ctx.states,
      }))

      bus.on('COMBAT_ROLLS', handler)
      bus.off('COMBAT_ROLLS', handler)

      bus.emit('COMBAT_ROLLS', { states: [createMockProbState()], round: 1 })

      expect(handler).not.toHaveBeenCalled()
    })

    it('does nothing when removing unregistered handler', () => {
      const bus = new CombatEventBus()
      const handler: EventHandler = ctx => ({ states: ctx.states })

      // Should not throw
      bus.off('COMBAT_ROLLS', handler)
      expect(bus.getHandlerCount('COMBAT_ROLLS')).toBe(0)
    })
  })

  describe('clear', () => {
    it('removes all handlers', () => {
      const bus = new CombatEventBus()
      const handler1: EventHandler = ctx => ({ states: ctx.states })
      const handler2: EventHandler = ctx => ({ states: ctx.states })

      bus.on('COMBAT_ROLLS', handler1)
      bus.on('AFB_ROLLS', handler2)

      bus.clear()

      expect(bus.getHandlerCount('COMBAT_ROLLS')).toBe(0)
      expect(bus.getHandlerCount('AFB_ROLLS')).toBe(0)
    })
  })

  describe('getHandlerCount', () => {
    it('returns correct count', () => {
      const bus = new CombatEventBus()
      const handler: EventHandler = ctx => ({ states: ctx.states })

      expect(bus.getHandlerCount('COMBAT_ROLLS')).toBe(0)

      bus.on('COMBAT_ROLLS', handler)
      expect(bus.getHandlerCount('COMBAT_ROLLS')).toBe(1)

      bus.on('COMBAT_ROLLS', handler)
      expect(bus.getHandlerCount('COMBAT_ROLLS')).toBe(2)
    })
  })

  describe('multiple events', () => {
    it('handles different events independently', () => {
      const bus = new CombatEventBus()
      const combatHandler: EventHandler = vi.fn(ctx => ({
        states: ctx.states,
      }))
      const afbHandler: EventHandler = vi.fn(ctx => ({
        states: ctx.states,
      }))

      bus.on('COMBAT_ROLLS', combatHandler)
      bus.on('AFB_ROLLS', afbHandler)

      bus.emit('COMBAT_ROLLS', { states: [createMockProbState()], round: 1 })

      expect(combatHandler).toHaveBeenCalledTimes(1)
      expect(afbHandler).not.toHaveBeenCalled()
    })
  })
})
