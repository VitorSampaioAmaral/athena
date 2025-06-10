'use client';

import { useEffect, useState } from 'react';
import { useProgress } from '@/lib/progress';
import { useAuth } from '@/hooks/useAuth';
import styles from './ImageAnalysis.module.css';

interface AnalysisResponse {
  analysis: string;
  errors?: string[];
  debug?: {
    textDetected: boolean;
    elementsCount: number;
    hasInterpretation: boolean;
    processingTime: string;
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

        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: imageData }),
        });

        updateProgress(50); // Análise em andamento

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao analisar imagem');
        }

        const data = await response.json();
        setResult(data);
        updateProgress(100); // Análise concluída
      } catch (err) {
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
      <div className={styles.errorContainer}>
        <h3>Acesso Restrito</h3>
        <p>Você precisa estar logado para analisar imagens.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <h3>Erro na Análise</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (progress < 100 && progress > 0) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill} 
            style={{ width: `${progress}%` }}
          />
        </div>
        <p>Analisando imagem... {progress}%</p>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className={styles.analysisContainer}>
      <div dangerouslySetInnerHTML={{ __html: result.analysis }} />
      {result.debug && (
        <div className={styles.debugInfo}>
          <p>Tempo de processamento: {result.debug.processingTime}ms</p>
          {result.debug.errorsCount > 0 && (
            <p className={styles.warningText}>
              {result.debug.errorsCount} erro(s) encontrado(s) durante o processamento
            </p>
          )}
        </div>
      )}
    </div>
  );
} 