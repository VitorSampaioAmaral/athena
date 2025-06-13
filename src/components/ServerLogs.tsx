import React, { useEffect, useState, useRef } from 'react';
import { ServerLog, serverEvents } from '@/utils/serverEvents';

interface ServerLogsProps {
  onStatusChange?: (status: {
    isCompiling: boolean;
    hasErrors: boolean;
    progress: number;
  }) => void;
}

export function ServerLogs({ onStatusChange }: ServerLogsProps) {
  const [logs, setLogs] = useState<ServerLog[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [hasErrors, setHasErrors] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleNewLog = (log: ServerLog) => {
      setLogs(prevLogs => [...prevLogs, log]);

      // Atualiza o status baseado no log
      if (log.message.includes('compiling')) {
        setIsCompiling(true);
        setHasErrors(false);
      } else if (log.message.includes('compiled')) {
        setIsCompiling(false);
      } else if (log.type === 'error') {
        setHasErrors(true);
      }

      // Calcula o progresso
      const progress = calculateProgress(logs);
      
      // Notifica sobre mudanças de status
      onStatusChange?.({
        isCompiling,
        hasErrors,
        progress
      });

      // Auto-scroll para o último log
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
    };

    const handleClear = () => {
      setLogs([]);
      setIsCompiling(false);
      setHasErrors(false);
      onStatusChange?.({
        isCompiling: false,
        hasErrors: false,
        progress: 0
      });
    };

    serverEvents.on('log', handleNewLog);
    serverEvents.on('clear', handleClear);

    return () => {
      serverEvents.off('log', handleNewLog);
      serverEvents.off('clear', handleClear);
    };
  }, [onStatusChange, isCompiling, hasErrors, logs]);

  const calculateProgress = (currentLogs: ServerLog[]): number => {
    const totalSteps = 5; // Número total de etapas esperadas
    const completedSteps = new Set(
      currentLogs
        .filter(log => log.message.includes('completed'))
        .map(log => log.message)
    ).size;

    return (completedSteps / totalSteps) * 100;
  };

  return (
    <div className="server-logs">
      <div className="server-status">
        <div className={`status-indicator ${isCompiling ? 'compiling' : ''} ${hasErrors ? 'error' : ''}`}>
          {isCompiling ? 'Compilando...' : hasErrors ? 'Erro' : 'Pronto'}
        </div>
      </div>
      <div ref={logContainerRef} className="log-container">
        {logs.map((log, index) => (
          <div key={index} className={`log-entry ${log.type}`}>
            <span className="log-time">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className="log-message">{log.message}</span>
            {log.details && (
              <pre className="log-details">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 