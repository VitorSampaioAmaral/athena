'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';

interface Collection {
  id: string;
  name: string;
  description?: string;
  accessId: string;
  createdAt: string;
  user: {
    id: string;
    name?: string;
    email: string;
  };
  items: Array<{
    id: string;
    transcription: {
      id: string;
      imageUrl: string;
      text: string;
      confidence: number;
      status: string;
      createdAt: string;
    };
  }>;
}

export default function Page({ params }: { params: { id: string } }) {
  const { status } = useSession();
  const router = useRouter();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCollection = useCallback(async () => {
    try {
      const response = await fetch(`/api/collections/${params.id}`);
      if (!response.ok) throw new Error('Erro ao buscar coleção');
      const data = await response.json();
      setCollection(data);
    } catch (error) {
      toast.error('Erro ao carregar coleção');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchCollection();
    }
  }, [status, router, fetchCollection]);

  const handleCopyAccessId = async () => {
    if (!collection) return;
    
    try {
      await navigator.clipboard.writeText(collection.accessId);
      toast.success('ID de acesso copiado para a área de transferência!');
    } catch (error) {
      toast.error('Erro ao copiar ID de acesso');
      console.error(error);
    }
  };

  const handleRemoveTranscription = async (transcriptionId: string) => {
    if (!confirm('Tem certeza que deseja remover esta transcrição da coleção?')) return;

    try {
      const response = await fetch(`/api/collections/${params.id}/remove-transcription`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcriptionId }),
      });

      if (!response.ok) throw new Error('Erro ao remover transcrição');

      toast.success('Transcrição removida da coleção');
      fetchCollection();
    } catch (error) {
      toast.error('Erro ao remover transcrição');
      console.error(error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"></div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-gray-800 p-8 text-center border border-gray-700">
          <p className="text-gray-300">Coleção não encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-white">{collection.name}</h1>
          <Button
            onClick={() => router.push('/collections')}
            variant="outline"
          >
            Voltar às Coleções
          </Button>
        </div>

        {collection.description && (
          <p className="text-gray-300 mb-4">{collection.description}</p>
        )}

        <div className="flex items-center space-x-4 mb-6">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400">ID de Acesso:</span>
            <code className="text-sm bg-gray-700 px-2 py-1 rounded text-green-300">
              {collection.accessId}
            </code>
            <Button
              onClick={handleCopyAccessId}
              size="sm"
              variant="outline"
            >
              Copiar
            </Button>
          </div>
          <span className="text-gray-400">•</span>
          <span className="text-sm text-gray-400">
            Criada por: {collection.user.name || collection.user.email}
          </span>
          <span className="text-gray-400">•</span>
          <span className="text-sm text-gray-400">
            {collection.items.length} transcrições
          </span>
        </div>
      </div>

      {collection.items.length === 0 ? (
        <div className="rounded-lg bg-gray-800 p-8 text-center border border-gray-700">
          <p className="text-gray-300">Nenhuma transcrição nesta coleção</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {collection.items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-gray-700 bg-gray-800 p-6 shadow-sm"
            >
              <div className="mb-4">
                {item.transcription.imageUrl && (
                  <img
                    src={item.transcription.imageUrl}
                    alt="Imagem transcrita"
                    className="h-48 w-full rounded object-cover"
                  />
                )}
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-400">
                  {new Date(item.transcription.createdAt).toLocaleString()}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-white">
                  {item.transcription.text}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    item.transcription.status === 'completed'
                      ? 'bg-green-900 text-green-300'
                      : item.transcription.status === 'error'
                      ? 'bg-red-900 text-red-300'
                      : 'bg-yellow-900 text-yellow-300'
                  }`}
                >
                  {item.transcription.status === 'completed'
                    ? 'Concluído'
                    : item.transcription.status === 'error'
                    ? 'Erro'
                    : 'Processando'}
                </span>
                <Button
                  onClick={() => handleRemoveTranscription(item.transcription.id)}
                  variant="outline"
                  size="sm"
                  className="text-red-400 hover:text-red-300"
                >
                  Remover
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 