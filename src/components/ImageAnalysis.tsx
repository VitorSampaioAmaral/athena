'use client';

import { useEffect, useState } from 'react';
import { useProgress } from '@/lib/progress';
import { useAuth } from '@/hooks/useAuth';
import styles from './ImageAnalysis.module.css';

interface AnalysisResponse {
  analysis: string;
  processingTime: string;
  status: 'success' | 'partial' | 'error';
  error?: string;
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

        const data = await response.json();
        console.log('Resposta da API:', data); // Log para debug

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao analisar imagem');
        }

        if (data.status === 'error') {
          throw new Error(data.error || 'Erro ao analisar imagem');
        }

        setResult({
          analysis: data.analysis,
          processingTime: data.processingTime,
          status: data.status,
          error: data.error
        });
        
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
      <div className={styles.errorContainer}>
        <h3 className={styles.errorsTitle}>Acesso Restrito</h3>
        <p>Você precisa estar logado para analisar imagens.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <h3 className={styles.errorsTitle}>Erro na Análise</h3>
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
        <p className={styles.progressText}>Analisando imagem... {progress}%</p>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className={styles.resultContainer}>
      <div className="prose prose-invert max-w-none">
        <div className={styles.resultText}>{result.analysis}</div>
      </div>
      <div className={styles.resultMeta}>
        <p>Tempo de processamento: {result.processingTime}</p>
        {result.status === 'partial' && result.error && (
          <p className={styles.warningText}>
            Aviso: {result.error}
          </p>
        )}
      </div>
    </div>
  );
} 