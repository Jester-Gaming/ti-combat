import type {
  CombatEventName,
  CombatEventContext,
  HandlerResult,
  EventHandler,
  RegisteredHandler,
} from './types'

/**
 * Event bus for combat simulation with priority-ordered handler execution.
 *
 * Provides:
 * - Priority ordering: handlers execute in ascending priority order (0 first)
 * - Synchronous execution: handlers process states in sequence
 * - State transformation: each handler can transform the states for the next
 */
export class CombatEventBus {
  private handlers: Map<CombatEventName, RegisteredHandler[]>

  constructor() {
    this.handlers = new Map()
  }

  /**
   * Register an event handler with priority.
   * Lower priority values execute first (0 = highest priority).
   *
   * @param event - Event name to subscribe to
   * @param handler - Handler function
   * @param priority - Execution priority (default: 0)
   */
  on(
    event: CombatEventName,
    handler: EventHandler,
    priority: number = 0,
  ): void {
    const registered: RegisteredHandler = { handler, priority }

    let eventHandlers = this.handlers.get(event)
    if (!eventHandlers) {
      eventHandlers = []
      this.handlers.set(event, eventHandlers)
    }

    eventHandlers.push(registered)
    // Sort by priority (ascending) - lower numbers first
    eventHandlers.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Unregister an event handler.
   *
   * @param event - Event name
   * @param handler - Handler function to remove
   */
  off(event: CombatEventName, handler: EventHandler): void {
    const eventHandlers = this.handlers.get(event)
    if (!eventHandlers) return

    const index = eventHandlers.findIndex(rh => rh.handler === handler)
    if (index !== -1) {
      eventHandlers.splice(index, 1)
    }
  }

  /**
   * Emit an event and execute all handlers in priority order.
   * Each handler receives the states from the previous handler.
   *
   * @param event - Event name to emit
   * @param context - Initial context with states and round
   * @returns Final handler result after all handlers execute
   */
  emit(event: CombatEventName, context: CombatEventContext): HandlerResult {
    const eventHandlers = this.handlers.get(event)

    if (!eventHandlers || eventHandlers.length === 0) {
      // No handlers - return states unchanged
      return { states: context.states }
    }

    // Execute handlers in priority order, chaining state transformations
    let currentStates = context.states

    for (const { handler } of eventHandlers) {
      const result = handler({
        states: currentStates,
        round: context.round,
      })
      currentStates = result.states
    }

    return { states: currentStates }
  }

  /**
   * Remove all handlers for all events.
   */
  clear(): void {
    this.handlers.clear()
  }

  /**
   * Get the number of handlers registered for an event.
   * Useful for testing.
   */
  getHandlerCount(event: CombatEventName): number {
    return this.handlers.get(event)?.length ?? 0
  }
}
