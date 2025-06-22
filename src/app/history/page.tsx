'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

interface Transcription {
  id: string;
  imageUrl: string;
  text: string;
  confidence: number;
  status: string;
  source: string;
  createdAt: string;
}

export default function HistoryPage() {
  const { status } = useSession();
  const router = useRouter();
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchTranscriptions();
    }
  }, [status, router]);

  const fetchTranscriptions = async () => {
    try {
      console.log('[DEBUG] Iniciando busca de transcrições...');
      const response = await fetch('/api/transcriptions');
      console.log('[DEBUG] Resposta da API:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DEBUG] Erro na resposta:', errorText);
        throw new Error('Erro ao buscar transcrições');
      }
      
      const data = await response.json();
      console.log('[DEBUG] Dados recebidos:', data);
      console.log('[DEBUG] Tipo dos dados:', typeof data);
      console.log('[DEBUG] É um array?', Array.isArray(data));
      console.log('[DEBUG] Tamanho do array:', Array.isArray(data) ? data.length : 'N/A');
      setTranscriptions(data);
    } catch (error) {
      console.error('[DEBUG] Erro completo:', error);
      toast.error('Erro ao carregar histórico');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-4">Histórico de Transcrições</h1>
        <p className="text-gray-300">
          Visualize todas as suas transcrições realizadas.
        </p>
      </div>

      {transcriptions.length === 0 ? (
        <div className="rounded-lg bg-gray-800 p-8 text-center border border-gray-700">
          <p className="text-gray-300">Nenhuma transcrição encontrada</p>
          <p className="text-gray-400 mt-2">
            Faça sua primeira transcrição para ver o histórico aqui.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {transcriptions.map((transcription) => (
            <div
              key={transcription.id}
              className="rounded-lg border border-gray-700 bg-gray-800 p-6 shadow-sm"
            >
              <div className="mb-4">
                {transcription.imageUrl && (
                  <img
                    src={transcription.imageUrl}
                    alt="Imagem transcrita"
                    className="h-48 w-full rounded object-cover"
                  />
                )}
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-400">
                  {new Date(transcription.createdAt).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  Origem: {transcription.source === 'file' ? 'Upload de arquivo' : 'URL'}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-white">
                  {transcription.text}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs ${
                  transcription.status === 'completed'
                    ? 'bg-green-900 text-green-300'
                    : transcription.status === 'error'
                    ? 'bg-red-900 text-red-300'
                    : 'bg-yellow-900 text-yellow-300'
                }`}
              >
                {transcription.status === 'completed'
                  ? 'Concluído'
                  : transcription.status === 'error'
                  ? 'Erro'
                  : 'Processando'}
              </span>
              <span className="text-xs text-gray-400">
                Confiança: {Math.round(transcription.confidence * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 