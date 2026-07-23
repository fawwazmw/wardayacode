/**
 * Hook System - event-driven extensibility
 */

import { HookEvent, Hook, HookContext, HookResult } from '../types.js';

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
   * Emit a hook event (fire-and-forget, no result collection)
   */
  async emit(event: HookEvent, context: HookContext): Promise<void> {
    const handlers = this.hooks.get(event) || [];
    for (const hook of handlers) {
      try {
        await hook.handler(context);
      } catch (error) {
        const hookId = hook.name ? `${hook.name} (${event})` : event;
        console.error(`[wardayacode] Hook error in ${hookId}:`, error instanceof Error ? error.message : error);
      }
    }
  }

  /**
   * Emit a hook event and collect results from all handlers.
   * Returns the merged result: if any handler returned { proceed: false },
   * the merged result has proceed = false. modifiedInput is accumulated
   * from the last handler that returned one.
   */
  async emitWithResult(event: HookEvent, context: HookContext): Promise<HookResult | undefined> {
    const handlers = this.hooks.get(event) || [];
    let merged: HookResult | undefined;

    for (const hook of handlers) {
      try {
        const result = await hook.handler(context);
        if (result) {
          if (!merged) merged = { proceed: true };
          if (result.proceed === false) {
            merged.proceed = false;
            merged.reason = result.reason;
          }
          if (result.modifiedInput) {
            merged.modifiedInput = result.modifiedInput;
          }
        }
      } catch (error) {
        const hookId = hook.name ? `${hook.name} (${event})` : event;
        console.error(`[wardayacode] Hook error in ${hookId}:`, error instanceof Error ? error.message : error);
      }
    }

    return merged;
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
