'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { CreateCollectionModal } from '@/components/CreateCollectionModal';

interface Transcription {
  id: string;
  imageUrl: string;
  text: string;
  confidence: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  createdAt: string;
}

export default function TranscricoesPage() {
  const { data: session, status } = useSession();
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
      const response = await fetch('/api/transcriptions');
      if (!response.ok) throw new Error('Erro ao buscar transcrições');
      const data = await response.json();
      setTranscriptions(data);
    } catch (error) {
      toast.error('Erro ao carregar transcrições');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta transcrição?')) return;

    try {
      const response = await fetch(`/api/transcriptions/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Erro ao excluir transcrição');

      toast.success('Transcrição excluída com sucesso');
      fetchTranscriptions();
    } catch (error) {
      toast.error('Erro ao excluir transcrição');
      console.error(error);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Tem certeza que deseja excluir TODAS as transcrições? Esta ação não pode ser desfeita.')) return;

    try {
      const deletePromises = transcriptions.map(transcription =>
        fetch(`/api/transcriptions/${transcription.id}`, {
          method: 'DELETE',
        })
      );

      await Promise.all(deletePromises);
      toast.success('Todas as transcrições foram excluídas');
      setTranscriptions([]);
    } catch (error) {
      toast.error('Erro ao excluir transcrições');
      console.error(error);
    }
  };

  const handleBackup = async () => {
    try {
      const data = JSON.stringify(transcriptions, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcricoes-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Backup realizado com sucesso');
    } catch (error) {
      toast.error('Erro ao realizar backup');
      console.error(error);
    }
  };

  const handleCollectionCreated = () => {
    toast.success('Transcrição adicionada à coleção com sucesso!');
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
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Histórico de Transcrições</h1>
        <div className="space-x-4">
          <button
            onClick={handleBackup}
            className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            Fazer Backup
          </button>
          <button
            onClick={handleDeleteAll}
            className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600"
          >
            Excluir Tudo
          </button>
        </div>
      </div>

      {transcriptions.length === 0 ? (
        <div className="rounded-lg bg-gray-800 p-8 text-center border border-gray-700">
          <p className="text-gray-300">Nenhuma transcrição encontrada</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {transcriptions.map((transcription) => (
            <div
              key={transcription.id}
              className="rounded-lg border border-gray-700 bg-gray-800 p-6 shadow-sm"
            >
              <div className="mb-4">
                <img
                  src={transcription.imageUrl}
                  alt="Imagem transcrita"
                  className="h-48 w-full rounded object-cover"
                />
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-400">
                  {new Date(transcription.createdAt).toLocaleString()}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-white">{transcription.text}</p>
              </div>
              <div className="flex items-center justify-between mb-3">
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
                <button
                  onClick={() => handleDelete(transcription.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  Excluir
                </button>
              </div>
              
              {/* Botão para adicionar à coleção */}
              <div className="mb-3">
                <CreateCollectionModal 
                  transcriptionId={transcription.id}
                  onCollectionCreated={handleCollectionCreated}
                />
              </div>
              
              {transcription.error && (
                <p className="mt-2 text-sm text-red-400">{transcription.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 