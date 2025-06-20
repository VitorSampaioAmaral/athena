import { EventEmitter } from 'events';

interface ServerEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

class ServerEventEmitter extends EventEmitter {
  private static instance: ServerEventEmitter;

  private constructor() {
    super();
  }

  static getInstance(): ServerEventEmitter {
    if (!ServerEventEmitter.instance) {
      ServerEventEmitter.instance = new ServerEventEmitter();
    }
    return ServerEventEmitter.instance;
  }

  emitEvent(event: ServerEvent): void {
    this.emit('server-event', event);
  }
}

export const serverEvents = ServerEventEmitter.getInstance(); 
