import { EventEmitter } from 'events';

export type DebugEventType = 'info' | 'warning' | 'error' | 'success';

export interface DebugEvent {
  id: string;
  timestamp: number;
  type: DebugEventType;
  source: string;
  message: string;
  details?: any;
}

class DebugEventBus extends EventEmitter {
  emitEvent(type: DebugEventType, source: string, message: string, details?: any) {
    const event: DebugEvent = {
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      type,
      source,
      message,
      details,
    };
    this.emit('debug-event', event);
  }
}

export const debugEventBus = new DebugEventBus();
