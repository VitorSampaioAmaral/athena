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
  const { startProgress, updateProgress } = useProgress();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    const analyzeImage = async () => {
      try {
        startProgress();
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: imageData }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao analisar imagem');
        }

        const data = await response.json();
        setResult(data);
        updateProgress(100);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao analisar imagem');
        updateProgress(100);
      }
    };

    if (imageData && isAuthenticated && user) {
      analyzeImage();
    }
  }, [imageData, isAuthenticated, user]);

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <h3>Erro na Análise</h3>
        <p>{error}</p>
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