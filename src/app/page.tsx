'use client';

import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { AnalysisProgress } from '@/components/AnalysisProgress';
import { ImageUpload } from '@/components/ImageUpload';
import { useSession } from 'next-auth/react';
import { AuthModal } from '@/components/AuthModal';
import { useRouter } from 'next/navigation';
import ImageUploader from '@/components/ImageUploader';

interface AnalysisStep {
  id: string;
  label: string;
  status: 'waiting' | 'loading' | 'completed' | 'error';
}

const initialSteps: AnalysisStep[] = [
  { id: 'text', label: 'Detectando texto na imagem', status: 'waiting' },
  { id: 'colors', label: 'Analisando cores e padrões', status: 'waiting' },
  { id: 'elements', label: 'Identificando elementos visuais', status: 'waiting' },
  { id: 'interpretation', label: 'Interpretando conteúdo', status: 'waiting' },
  { id: 'summary', label: 'Gerando resumo final', status: 'waiting' }
];

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const { data: session, status } = useSession();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;
  const [steps, setSteps] = useState<AnalysisStep[]>(initialSteps);
  const [result, setResult] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [shouldSave, setShouldSave] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  const onDrop = async (acceptedFiles: File[]) => {
    if (!isAuthenticated) {
      setError('Faça login para analisar imagens');
      return;
    }

    if (acceptedFiles.length === 0) {
      setError('Por favor, selecione uma imagem.');
      return;
    }

    const file = acceptedFiles[0];
    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione um arquivo de imagem válido.');
      return;
    }

    setIsLoading(true);
    setError('');
    setAnalysis('');
    setSteps(initialSteps);
    setIsAnalyzing(true);

    // Função para atualizar status com timeout de segurança
    const updateStepWithTimeout = async (stepId: string, status: 'loading' | 'completed', timeoutMs: number) => {
      updateStepStatus(stepId, status);
      if (status === 'loading') {
        // Adiciona um timeout de segurança para evitar que a etapa fique travada
        setTimeout(() => {
          setSteps(currentSteps => {
            const step = currentSteps.find(s => s.id === stepId);
            if (step && step.status === 'loading') {
              return currentSteps.map(s =>
                s.id === stepId ? { ...s, status: 'error' } : s
              );
            }
            return currentSteps;
          });
        }, timeoutMs);
      }
    };

    try {
      // Atualiza status para leitura do arquivo
      await updateStepWithTimeout('text', 'loading', 10000);
      
      // Lê o arquivo como base64
      const reader = new FileReader();
      const imageData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Inicia a análise
      await updateStepWithTimeout('text', 'completed', 0);
      await updateStepWithTimeout('colors', 'loading', 15000);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos de timeout

      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: imageData }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error('Falha na análise da imagem');
        }

        const data = await response.json();

        // Atualiza os status baseado no debug retornado
        if (data.debug) {
          if (data.debug.textDetected) {
            await updateStepWithTimeout('colors', 'completed', 0);
            await updateStepWithTimeout('elements', 'loading', 15000);
            await updateStepWithTimeout('elements', 'completed', 0);
          }
          if (data.debug.elementsCount > 0) {
            await updateStepWithTimeout('interpretation', 'loading', 15000);
            await updateStepWithTimeout('interpretation', 'completed', 0);
          }
          if (data.debug.hasInterpretation) {
            await updateStepWithTimeout('summary', 'loading', 10000);
            await updateStepWithTimeout('summary', 'completed', 0);
          }
        }

        setAnalysis(data.analysis);
        setRetryCount(0);
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('A análise demorou muito tempo. Por favor, tente novamente.');
        }
        throw error;
      }
    } catch (err: any) {
      console.error('Erro:', err);
      setError(err.message || 'Ocorreu um erro ao analisar a imagem.');
      
      // Marca os steps não completados como erro
      setSteps(currentSteps =>
        currentSteps.map(step =>
          step.status === 'loading' || step.status === 'waiting'
            ? { ...step, status: 'error' }
            : step
        )
      );
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.bmp', '.tiff']
    },
    maxSize: 5242880
  });

  const updateStepStatus = (stepId: string, status: AnalysisStep['status']) => {
    setSteps(currentSteps =>
      currentSteps.map(step =>
        step.id === stepId ? { ...step, status } : step
      )
    );
  };

  const handleAnalysis = async (imageData: string) => {
    setIsAnalyzing(true);
    setResult('');
    setSteps(initialSteps);

    try {
      // Faz a chamada à API
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageData }),
      });

      if (!response.ok) {
        throw new Error('Falha na análise');
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data.analysis);

    } catch (error) {
      console.error('Erro na análise:', error);
      // Marca como erro apenas os steps que estavam em loading
      setSteps(currentSteps => 
        currentSteps.map(step => ({
          ...step,
          status: step.status === 'loading' ? 'error' : step.status
        }))
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStepUpdate = (stepId: string, status: string, progress?: number, message?: string) => {
    setSteps(currentSteps => 
      currentSteps.map(step => {
        if (step.id === stepId) {
          return {
            ...step,
            status: status as 'waiting' | 'loading' | 'completed' | 'error',
            progress,
            message
          };
        }
        // Se um step está em loading, os próximos devem estar em waiting
        if (step.status === 'loading' && status === 'completed') {
          const currentIndex = currentSteps.findIndex(s => s.id === stepId);
          const stepIndex = currentSteps.findIndex(s => s.id === step.id);
          if (stepIndex > currentIndex) {
            return { ...step, status: 'waiting' };
          }
        }
        return step;
      })
    );
  };

  const handleImageSelect = async (file: File) => {
    setError('');
    setIsLoading(true);
    setUploadProgress(0);
    setSteps(initialSteps);
    setIsAnalyzing(true);

    try {
      // Converte a imagem para base64
      const reader = new FileReader();
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          setUploadProgress(progress);
        }
      };

      reader.onload = async () => {
        try {
          const base64Image = reader.result as string;
          setUploadProgress(100);

          // Inicia a análise
          handleStepUpdate('text', 'loading');
          const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: base64Image }),
          });

          if (!response.ok) {
            throw new Error('Falha na análise');
          }

          const data = await response.json();
          
          if (data.error) {
            throw new Error(data.error);
          }

          setResult(data.analysis);
          handleStepUpdate('text', 'completed');
          handleStepUpdate('colors', 'completed');
          handleStepUpdate('elements', 'completed');
          handleStepUpdate('interpretation', 'completed');
          handleStepUpdate('summary', 'completed');

        } catch (error) {
          console.error('Erro ao processar imagem:', error);
          setError('Erro ao processar a imagem. Por favor, tente novamente.');
          setSteps(currentSteps =>
            currentSteps.map(step => ({
              ...step,
              status: step.status === 'loading' || step.status === 'waiting' ? 'error' : step.status
            }))
          );
        } finally {
          setIsLoading(false);
          setIsAnalyzing(false);
        }
      };

      reader.onerror = () => {
        setError('Erro ao ler o arquivo. Por favor, tente novamente.');
        setIsLoading(false);
        setIsAnalyzing(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Erro ao selecionar imagem:', error);
      setError('Erro ao selecionar a imagem. Por favor, tente novamente.');
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  };

  const handleSaveAnalysis = async () => {
    if (!session) {
      setShouldSave(true);
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const response = await fetch('/api/analysis/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          result
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar análise');
      }

      // Feedback de sucesso
      alert('Análise salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setError('Erro ao salvar análise. Tente novamente.');
    }
  };

  const handleAuthSuccess = async () => {
    if (shouldSave) {
      setShouldSave(false);
      await handleSaveAnalysis();
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
          <p className="text-lg text-white">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-white">Você precisa estar logado para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-center text-4xl font-bold">
        Análise de Imagens com IA
      </h1>
      <ImageUploader />
    </main>
  );
}
