/**
 * EventBus — Simple pub/sub event system.
 * Decouples ShapeStore mutations from rendering, persistence, and UI updates.
 * When ShapeStore changes, it emits a "change" event.
 * Renderer, UIPanel, AriaLiveRegion, and LocalStorageAdapter all subscribe independently.
 */
class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Register a listener for an event.
   * @param {string} event - Event name to listen for.
   * @param {Function} callback - Function to call when event is emitted.
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
  }

  /**
   * Unregister a listener for an event.
   * @param {string} event - Event name to stop listening for.
   * @param {Function} callback - The exact function reference previously passed to on().
   */
  off(event, callback) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this._listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event, notifying all registered listeners.
   * @param {string} event - Event name to emit.
   * @param {*} [data] - Optional data to pass to each listener.
   */
  emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        callback(data);
      }
    }
  }
}

// Export for Node.js testing (no-op in browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EventBus };
}
