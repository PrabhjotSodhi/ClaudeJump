// Each scene owns its own instance, so listeners from one match never leak into another.
export class EventEmitter {
  constructor() {
    this.listenersByEventName = new Map();
  }

  on(eventName, listener) {
    if (!this.listenersByEventName.has(eventName)) this.listenersByEventName.set(eventName, []);
    this.listenersByEventName.get(eventName).push(listener);
  }

  emit(eventName, eventData) {
    for (const listener of this.listenersByEventName.get(eventName) ?? []) listener(eventData);
  }
}
