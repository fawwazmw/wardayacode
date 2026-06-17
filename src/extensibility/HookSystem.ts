/**
 * Hook System - event-driven extensibility
 */

import { HookEvent, Hook, HookContext } from '../types.js';

export class HookSystem {
  private hooks = new Map<HookEvent, Hook[]>();

  /**
   * Register a hook
   */
  register(hook: Hook): void {
    if (!this.hooks.has(hook.event)) {
      this.hooks.set(hook.event, []);
    }
    const handlers = this.hooks.get(hook.event)!;
    handlers.push(hook);
    // Sort by priority (higher = runs first)
    handlers.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Emit a hook event
   */
  async emit(event: HookEvent, context: HookContext): Promise<void> {
    const handlers = this.hooks.get(event) || [];
    for (const hook of handlers) {
      try {
        await hook.handler(context);
      } catch (error) {
        console.error(`Hook error in ${event}:`, error);
      }
    }
  }

  /**
   * Get all hooks for an event
   */
  getHooks(event: HookEvent): Hook[] {
    return [...(this.hooks.get(event) || [])];
  }

  /**
   * Remove a hook
   */
  unregister(event: HookEvent, handler: Hook['handler']): void {
    const handlers = this.hooks.get(event);
    if (handlers) {
      const index = handlers.findIndex(h => h.handler === handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }
}
