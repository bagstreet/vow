// Channel adapter registry (T47). Adapter contract:
//   { id, send(msg) -> Promise, presence() -> {state:'online'|'last_seen'|'unknown', ts?}, supportsButtons }
export const DEFAULT_ORDER = ['desktop', 'telegram', 'web', 'extension', 'slack', 'discord', 'push'];

export function assertAdapter(a) {
  if (!a || typeof a.id !== 'string' || !a.id) throw new TypeError('adapter.id required');
  if (typeof a.send !== 'function') throw new TypeError(`adapter ${a.id}: send() required`);
  if (typeof a.presence !== 'function') throw new TypeError(`adapter ${a.id}: presence() required`);
  return a;
}

export class ChannelRegistry {
  #items = new Map();
  register(adapter) {
    assertAdapter(adapter);
    if (this.#items.has(adapter.id)) throw new Error(`channel already registered: ${adapter.id}`);
    this.#items.set(adapter.id, adapter);
    return this;
  }
  unregister(id) { return this.#items.delete(id); }
  get(id) { return this.#items.get(id); }
  list() { return [...this.#items.values()]; }
}
