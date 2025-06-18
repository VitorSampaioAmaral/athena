'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useDropzone } from 'react-dropzone';
import ImageUploader from '@/components/ImageUploader';

type InputMethod = 'file' | 'url';

export default function TranscribePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [transcription, setTranscription] = useState('');
  const [visualDescription, setVisualDescription] = useState('');
  const [context, setContext] = useState('');
  const [ocrStatus, setOcrStatus] = useState<'checking' | 'available' | 'error'>('checking');
  const [inputMethod, setInputMethod] = useState<InputMethod>('file');
  const [imageUrl, setImageUrl] = useState('');

  // Verificar status do OCR ao carregar a página
  useEffect(() => {
    const checkOCRStatus = async () => {
      try {
        const response = await fetch('/api/ocr-status');
        if (response.ok) {
          setOcrStatus('available');
        } else {
          setOcrStatus('error');
        }
      } catch (error) {
        console.error('Erro ao verificar status do OCR:', error);
        setOcrStatus('error');
      }
    };

    checkOCRStatus();
  }, []);

  const onDrop = async (acceptedFiles: File[]) => {
    if (isLoading) return;
    if (acceptedFiles.length === 0) {
      setError('Por favor, selecione uma imagem.');
      return;
    }

    if (ocrStatus === 'error') {
      setError('Sistema de transcrição via OpenRouter temporariamente indisponível. Verifique a configuração da API.');
      return;
    }

    if (ocrStatus === 'checking') {
      setError('Verificando disponibilidade do sistema de transcrição...');
      return;
    }

    const file = acceptedFiles[0];
    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione uma imagem válida.');
      return;
    }

    await processImage(file);
  };

  const processImageUrl = async () => {
    if (isLoading) return;
    if (!imageUrl.trim()) {
      setError('Por favor, insira uma URL válida.');
      return;
    }

    if (ocrStatus === 'error') {
      setError('Sistema de transcrição via OpenRouter temporariamente indisponível. Verifique a configuração da API.');
      return;
    }

    if (ocrStatus === 'checking') {
      setError('Verificando disponibilidade do sistema de transcrição...');
      return;
    }

    // Validar URL
    try {
      new URL(imageUrl);
    } catch {
      setError('Por favor, insira uma URL válida.');
      return;
    }

    await processImageFromUrl(imageUrl);
  };

  const processImage = async (file: File) => {
    setIsLoading(true);
    setError('');
    setTranscription('');
    setVisualDescription('');
    setContext('');

    try {
      console.log('Iniciando upload da imagem...');
      const formData = new FormData();
      formData.append('image', file);

      console.log('Enviando requisição para a API...');
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Erro na resposta da API:', errorData);
        
        if (response.status === 429) {
          if (errorData.nextAvailable) {
            const nextTime = new Date(errorData.nextAvailable).toLocaleTimeString();
            throw new Error(`Aguarde antes de fazer outra transcrição. Próxima disponível às ${nextTime}`);
          } else {
            throw new Error(errorData.error || 'Limite diário de transcrições atingido');
          }
        }
        
        throw new Error(errorData.error || 'Falha na transcrição da imagem');
      }

      const data = await response.json();
      console.log('Resposta da API:', data);

      if (!data.transcription) {
        console.error('Transcrição não encontrada na resposta:', data);
        throw new Error('Transcrição não encontrada na resposta');
      }

      // Processar resposta estruturada
      const fullResponse = data.transcription;
      
      // Extrair seções usando regex
      const textMatch = fullResponse.match(/=== TEXTO EXTRAÍDO ===\n([\s\S]*?)(?=\n=== DESCRIÇÃO VISUAL ===|$)/);
      const visualMatch = fullResponse.match(/=== DESCRIÇÃO VISUAL ===\n([\s\S]*?)(?=\n=== CONTEXTO ===|$)/);
      const contextMatch = fullResponse.match(/=== CONTEXTO ===\n([\s\S]*?)$/);

      setTranscription(textMatch ? textMatch[1].trim() : fullResponse);
      setVisualDescription(visualMatch ? visualMatch[1].trim() : '');
      setContext(contextMatch ? contextMatch[1].trim() : '');
      
      console.log('Análise estruturada:', {
        text: textMatch ? textMatch[1].trim() : fullResponse,
        visual: visualMatch ? visualMatch[1].trim() : '',
        context: contextMatch ? contextMatch[1].trim() : ''
      });
    } catch (err: any) {
      console.error('Erro completo:', err);
      setError(err.message || 'Ocorreu um erro ao transcrever a imagem.');
    } finally {
      setIsLoading(false);
    }
  };

  const processImageFromUrl = async (url: string) => {
    setIsLoading(true);
    setError('');
    setTranscription('');
    setVisualDescription('');
    setContext('');

    try {
      console.log('Iniciando processamento da URL da imagem...');
      
      const response = await fetch('/api/transcribe-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Erro na resposta da API:', errorData);
        
        if (response.status === 429) {
          if (errorData.nextAvailable) {
            const nextTime = new Date(errorData.nextAvailable).toLocaleTimeString();
            throw new Error(`Aguarde antes de fazer outra transcrição. Próxima disponível às ${nextTime}`);
          } else {
            throw new Error(errorData.error || 'Limite diário de transcrições atingido');
          }
        }
        
        throw new Error(errorData.error || 'Falha na transcrição da imagem');
      }

      const data = await response.json();
      console.log('Resposta da API:', data);

      if (!data.transcription) {
        console.error('Transcrição não encontrada na resposta:', data);
        throw new Error('Transcrição não encontrada na resposta');
      }

      // Processar resposta estruturada
      const fullResponse = data.transcription;
      
      // Extrair seções usando regex
      const textMatch = fullResponse.match(/=== TEXTO EXTRAÍDO ===\n([\s\S]*?)(?=\n=== DESCRIÇÃO VISUAL ===|$)/);
      const visualMatch = fullResponse.match(/=== DESCRIÇÃO VISUAL ===\n([\s\S]*?)(?=\n=== CONTEXTO ===|$)/);
      const contextMatch = fullResponse.match(/=== CONTEXTO ===\n([\s\S]*?)$/);

      setTranscription(textMatch ? textMatch[1].trim() : fullResponse);
      setVisualDescription(visualMatch ? visualMatch[1].trim() : '');
      setContext(contextMatch ? contextMatch[1].trim() : '');
      
      console.log('Análise estruturada:', {
        text: textMatch ? textMatch[1].trim() : fullResponse,
        visual: visualMatch ? visualMatch[1].trim() : '',
        context: contextMatch ? contextMatch[1].trim() : ''
      });
    } catch (err: any) {
      console.error('Erro completo:', err);
      setError(err.message || 'Ocorreu um erro ao transcrever a imagem.');
    } finally {
      setIsLoading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    },
    maxSize: 10485760 // 10MB
  });

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900">
        <h1 className="mb-8 text-4xl font-bold text-white">Acesso Restrito</h1>
        <p className="mb-8 text-center text-lg text-gray-300">
          Você precisa estar logado para acessar esta página
        </p>
        <button
          onClick={() => router.push('/login')}
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-500"
        >
          Fazer Login
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-center text-4xl font-bold text-white">
        Análise Acessível de Imagens
      </h1>
      <ImageUploader />
    </div>
  );
} 