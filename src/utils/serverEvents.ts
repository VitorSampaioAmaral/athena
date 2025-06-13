import { EventEmitter } from 'events';

export interface ServerLog {
  timestamp: number;
  type: 'info' | 'error' | 'warning';
  message: string;
  details?: any;
}

class ServerEventEmitter extends EventEmitter {
  private static instance: ServerEventEmitter;
  private logs: ServerLog[] = [];

  private constructor() {
    super();
  }

  public static getInstance(): ServerEventEmitter {
    if (!ServerEventEmitter.instance) {
      ServerEventEmitter.instance = new ServerEventEmitter();
    }
    return ServerEventEmitter.instance;
  }

  public addLog(log: ServerLog) {
    this.logs.push(log);
    this.emit('log', log);
  }

  public getLogs() {
    return this.logs;
  }

  public clearLogs() {
    this.logs = [];
    this.emit('clear');
  }
}

export const serverEvents = ServerEventEmitter.getInstance(); 