'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useDropzone } from 'react-dropzone';
import CreditStatus from '@/components/CreditStatus';

export default function TranscribePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [transcription, setTranscription] = useState('');
  const [visualDescription, setVisualDescription] = useState('');
  const [context, setContext] = useState('');
  const [ocrStatus, setOcrStatus] = useState<'checking' | 'available' | 'error'>('checking');

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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    },
    maxSize: 10485760 // 10MB
  });

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <h1 className="mb-8 text-4xl font-bold">Acesso Restrito</h1>
        <p className="mb-8 text-center text-lg text-gray-600">
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
      <h1 className="mb-8 text-center text-4xl font-bold">
        Análise Acessível de Imagens
      </h1>

      <CreditStatus />

      <div
        {...getRootProps()}
        className={`mb-8 rounded-lg border-2 border-dashed p-8 text-center ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-500'
        }`}
      >
        <input {...getInputProps()} />
        {isLoading ? (
          <div className="flex flex-col items-center">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            <p>Processando imagem...</p>
          </div>
        ) : (
          <div>
            <p className="mb-4 text-lg">
              {isDragActive
                ? 'Solte a imagem aqui'
                : 'Arraste uma imagem ou clique para selecionar'}
            </p>
            <p className="text-sm text-gray-500">
              Formatos aceitos: JPG, JPEG, PNG, GIF, WEBP (máx. 10MB)
            </p>
            <p className="mt-2 text-sm text-blue-600">
              ✨ Análise completa: texto, descrição visual e contexto para acessibilidade
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-8 rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-semibold">Análise Completa da Imagem:</h2>
        {isLoading ? (
          <div>
            <p>A imagem foi carregada com sucesso e está sendo analisada.</p>
            <p className="mt-2">Aguarde enquanto processamos os detalhes da imagem...</p>
          </div>
        ) : transcription || visualDescription || context ? (
          <div className="space-y-6">
            {/* Seção de Texto Extraído */}
            {transcription && (
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="mb-2 text-lg font-semibold text-blue-700">
                  📝 Texto Extraído
                </h3>
                <p className="whitespace-pre-wrap text-gray-700 bg-blue-50 p-3 rounded">
                  {transcription}
                </p>
              </div>
            )}

            {/* Seção de Descrição Visual */}
            {visualDescription && (
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="mb-2 text-lg font-semibold text-green-700">
                  👁️ Descrição Visual
                </h3>
                <p className="whitespace-pre-wrap text-gray-700 bg-green-50 p-3 rounded">
                  {visualDescription}
                </p>
              </div>
            )}

            {/* Seção de Contexto */}
            {context && (
              <div className="border-l-4 border-purple-500 pl-4">
                <h3 className="mb-2 text-lg font-semibold text-purple-700">
                  🎯 Contexto da Imagem
                </h3>
                <p className="whitespace-pre-wrap text-gray-700 bg-purple-50 p-3 rounded">
                  {context}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500">Faça upload de uma imagem para ver a análise completa.</p>
        )}
      </div>
    </div>
  );
} 