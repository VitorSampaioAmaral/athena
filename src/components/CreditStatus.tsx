'use client';

import { useState, useEffect } from 'react';

interface CreditStatus {
  usedToday: number;
  remaining: number;
  nextAvailable: Date | null;
  dailyLimit: number;
  canTranscribe: boolean;
}

export default function CreditStatus() {
  const [status, setStatus] = useState<CreditStatus | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/credits');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Erro ao buscar status de créditos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // Atualizar a cada 10 segundos
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!status?.nextAvailable) {
      setTimeLeft('');
      return;
    }

    const updateTimeLeft = () => {
      const now = new Date().getTime();
      const next = status.nextAvailable ? new Date(status.nextAvailable).getTime() : 0;
      const diff = next - now;

      if (diff <= 0) {
        setTimeLeft('');
        fetchStatus(); // Recarregar status
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [status?.nextAvailable]);

  if (loading) {
    return (
      <div className="mb-4 rounded-lg bg-gray-100 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const progress = (status.usedToday / status.dailyLimit) * 100;
  const isNearLimit = status.remaining <= 5;
  const isAtLimit = status.remaining === 0;

  return (
    <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">
          Créditos de Transcrição
        </h3>
        <span className={`text-sm font-medium ${
          isAtLimit ? 'text-red-600' : 
          isNearLimit ? 'text-yellow-600' : 
          'text-green-600'
        }`}>
          {status.remaining} restantes
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="mb-3">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Usado hoje: {status.usedToday}</span>
          <span>Limite: {status.dailyLimit}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              isAtLimit ? 'bg-red-500' : 
              isNearLimit ? 'bg-yellow-500' : 
              'bg-green-500'
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Status de disponibilidade */}
      {!status.canTranscribe && status.nextAvailable && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Aguarde antes da próxima transcrição
              </h3>
              <div className="mt-1 text-sm text-yellow-700">
                {timeLeft && (
                  <span className="font-mono font-bold">
                    Próxima transcrição disponível em: {timeLeft}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isAtLimit && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Limite diário atingido
              </h3>
              <div className="mt-1 text-sm text-red-700">
                Você atingiu o limite de {status.dailyLimit} transcrições por dia. 
                O limite será resetado amanhã.
              </div>
            </div>
          </div>
        </div>
      )}

      {status.canTranscribe && !isAtLimit && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                Pronto para transcrição
              </h3>
              <div className="mt-1 text-sm text-green-700">
                Você pode fazer transcrições agora. 
                {isNearLimit && ` Restam apenas ${status.remaining} transcrições hoje.`}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 