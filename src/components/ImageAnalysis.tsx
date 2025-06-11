'use client';

import { useEffect, useState } from 'react';
import { useProgress } from '@/lib/progress';
import { useAuth } from '@/hooks/useAuth';
import styles from './ImageAnalysis.module.css';

interface AnalysisResponse {
  analysis: string;
  debug?: {
    processingTime: number;
    errorsCount: number;
  };
}

export function ImageAnalysis({ imageData }: { imageData: string }) {
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { progress, startProgress, updateProgress } = useProgress();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    const analyzeImage = async () => {
      try {
        startProgress();
        updateProgress(10); // Iniciando análise

        // Converte base64 para Blob
        const base64Data = imageData.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/jpeg' });

        // Cria FormData e adiciona o arquivo
        const formData = new FormData();
        formData.append('file', blob, 'image.jpg');

        updateProgress(30); // Upload iniciado

        const response = await fetch('/api/analyze', {
          method: 'POST',
          body: formData,
        });

        updateProgress(50); // Análise em andamento

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao analisar imagem');
        }

        const data = await response.json();
        console.log('Resposta da API:', data); // Log para debug
        
        if (data.description) {
          setResult({
            analysis: data.description,
            debug: {
              processingTime: data.processingTime || 0,
              errorsCount: 0
            }
          });
        } else {
          throw new Error('Resposta inválida da API');
        }
        
        updateProgress(100); // Análise concluída
      } catch (err) {
        console.error('Erro na análise:', err);
        setError(err instanceof Error ? err.message : 'Erro ao analisar imagem');
        updateProgress(100);
      }
    };

    if (imageData && isAuthenticated && user) {
      analyzeImage();
    }
  }, [imageData, isAuthenticated, user]);

  if (!isAuthenticated || !user) {
    return (
      <div className="mt-4 rounded-lg bg-red-500/10 p-4 text-red-400">
        <h3 className="font-bold">Acesso Restrito</h3>
        <p>Você precisa estar logado para analisar imagens.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 rounded-lg bg-red-500/10 p-4 text-red-400">
        <h3 className="font-bold">Erro na Análise</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (progress < 100 && progress > 0) {
    return (
      <div className="mt-4 rounded-lg bg-blue-500/10 p-4">
        <div className="h-2 w-full rounded-full bg-gray-700">
          <div 
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-center text-blue-400">Analisando imagem... {progress}%</p>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="mt-4 rounded-lg bg-gray-800 p-4">
      <div className="prose prose-invert max-w-none">
        <div className="whitespace-pre-wrap">{result.analysis}</div>
      </div>
      {result.debug && (
        <div className="mt-4 text-sm text-gray-400">
          <p>Tempo de processamento: {result.debug.processingTime}ms</p>
          {result.debug.errorsCount > 0 && (
            <p className="text-red-400">
              {result.debug.errorsCount} erro(s) encontrado(s) durante o processamento
            </p>
          )}
        </div>
      )}
    </div>
  );
} 