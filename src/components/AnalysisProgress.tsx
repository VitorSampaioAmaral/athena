import React, { useEffect, useState } from 'react';
import { ServerLogs } from './ServerLogs';

interface AnalysisStep {
  id: string;
  label: string;
  status: 'waiting' | 'loading' | 'completed' | 'error';
  progress?: number;
  message?: string;
}

interface AnalysisProgressProps {
  steps: AnalysisStep[];
  onStepUpdate?: (stepId: string, status: AnalysisStep['status'], progress?: number, message?: string) => void;
}

export function AnalysisProgress({ steps: initialSteps, onStepUpdate }: AnalysisProgressProps) {
  const [steps, setSteps] = useState<AnalysisStep[]>(initialSteps);
  const [serverStatus, setServerStatus] = useState({
    isCompiling: false,
    hasErrors: false,
    progress: 0
  });

  // Atualiza os steps quando o initialSteps mudar
  useEffect(() => {
    setSteps(initialSteps);
  }, [initialSteps]);

  useEffect(() => {
    let eventSource: EventSource;

    const connectToSSE = () => {
      eventSource = new EventSource('/api/progress');

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Atualiza o step correspondente
          setSteps(currentSteps => {
            const updatedSteps = currentSteps.map(step => {
              if (step.id === data.stage) {
                const newStep = {
                  ...step,
                  status: data.status === 'started' ? 'loading' : data.status,
                  message: data.message,
                  progress: data.progress
                };
                return newStep;
              }
              return step;
            });

            // Notifica o componente pai sobre a atualização em um setTimeout
            const updatedStep = updatedSteps.find(step => step.id === data.stage);
            if (updatedStep && onStepUpdate) {
              setTimeout(() => {
                onStepUpdate(
                  data.stage,
                  updatedStep.status,
                  updatedStep.progress,
                  updatedStep.message
                );
              }, 0);
            }

            return updatedSteps;
          });

          // Atualiza o progresso geral
          if (data.progress !== undefined) {
            setServerStatus(prev => ({
              ...prev,
              progress: data.progress
            }));
          }
        } catch (error) {
          console.error('Erro ao processar evento de progresso:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('Erro na conexão SSE:', error);
        eventSource.close();
        // Tenta reconectar após 5 segundos
        setTimeout(connectToSSE, 5000);
      };
    };

    connectToSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [onStepUpdate]);

  const getStatusColor = (step: AnalysisStep) => {
    if (serverStatus.hasErrors) return 'bg-red-500';
    
    switch (step.status) {
      case 'waiting':
        return 'bg-secondary-400';
      case 'loading':
        return serverStatus.isCompiling ? 'bg-yellow-400 animate-pulse' : 'bg-primary-400 animate-pulse';
      case 'completed':
        return 'bg-primary-600';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-secondary-400';
    }
  };

  const getStatusIcon = (step: AnalysisStep) => {
    if (serverStatus.hasErrors) return '×';
    
    switch (step.status) {
      case 'waiting':
        return '⋯';
      case 'loading':
        return serverStatus.isCompiling ? '⟳' : '↻';
      case 'completed':
        return '✓';
      case 'error':
        return '×';
      default:
        return '⋯';
    }
  };

  // Calcula o progresso total
  const totalProgress = Math.max(
    (steps.filter(s => s.status === 'completed').length / steps.length) * 100,
    steps.find(s => s.status === 'loading')?.progress || 0,
    serverStatus.progress
  );

  return (
    <div className="w-full max-w-2xl mx-auto my-8 p-6 bg-secondary-900/50 rounded-xl backdrop-blur-sm">
      <div className="relative">
        {/* Barra de Progresso Principal */}
        <div className="h-2 bg-secondary-700 rounded-full overflow-hidden mb-6">
          <div 
            className={`h-full transition-all duration-500 ease-out ${
              serverStatus.hasErrors ? 'bg-red-500' :
              serverStatus.isCompiling ? 'bg-yellow-400' : 'bg-primary-600'
            }`}
            style={{
              width: `${totalProgress}%`
            }}
          />
        </div>

        {/* Contador de Progresso */}
        <div className="absolute -top-6 right-0 text-sm text-secondary-400">
          {steps.filter(s => s.status === 'completed').length} de {steps.length} etapas
        </div>

        {/* Status do Servidor */}
        {serverStatus.isCompiling && (
          <div className="absolute -top-6 left-0 text-sm text-yellow-400 animate-pulse">
            Compilando...
          </div>
        )}

        {/* Steps */}
        <div className="mt-4 grid grid-cols-1 gap-3">
          {steps.map((step, index) => (
            <div 
              key={step.id}
              className={`flex items-center p-4 rounded-lg border transition-all duration-300 ${
                step.status === 'loading' && serverStatus.isCompiling
                  ? 'border-yellow-400 bg-yellow-400/5'
                  : step.status === 'loading' 
                  ? 'border-primary-400 bg-primary-400/5' 
                  : step.status === 'completed'
                  ? 'border-primary-600/30 bg-primary-600/5'
                  : step.status === 'error'
                  ? 'border-red-500/30 bg-red-500/5'
                  : 'border-secondary-700 bg-secondary-800/50'
              }`}
            >
              {/* Número do Step */}
              <div className="mr-4 text-sm text-secondary-500 w-6 text-center">
                {index + 1}
              </div>

              {/* Ícone de Status */}
              <div 
                className={`w-8 h-8 flex items-center justify-center rounded-full mr-4 ${getStatusColor(step)} text-white
                  ${step.status === 'loading' ? 'animate-spin-slow' : ''}`}
              >
                <span className="text-lg">{getStatusIcon(step)}</span>
              </div>

              {/* Label e Mensagem */}
              <div className="flex-1">
                <span className={`block ${
                  step.status === 'loading' && serverStatus.isCompiling
                    ? 'text-yellow-400'
                    : step.status === 'loading' 
                    ? 'text-primary-400' 
                    : step.status === 'completed'
                    ? 'text-primary-200'
                    : step.status === 'error'
                    ? 'text-red-400'
                    : 'text-secondary-400'
                }`}>
                  {step.label}
                </span>
                {step.message && (
                  <span className="block mt-1 text-sm text-secondary-500">
                    {step.message}
                  </span>
                )}
              </div>

              {/* Progresso (se disponível) */}
              {step.progress !== undefined && step.status === 'loading' && (
                <div className="ml-4 text-sm text-secondary-500">
                  {Math.round(step.progress)}%
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Logs do Servidor */}
        <ServerLogs onStatusChange={setServerStatus} />
      </div>
    </div>
  );
} 
