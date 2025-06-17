'use client';

import { useEffect, useState } from 'react';
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

export default function CollectionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchCollections();
    }
  }, [status, router]);

  const fetchCollections = async () => {
    try {
      const response = await fetch('/api/collections');
      if (!response.ok) throw new Error('Erro ao buscar coleções');
      const data = await response.json();
      setCollections(data);
    } catch (error) {
      toast.error('Erro ao carregar coleções');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCollection = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta coleção?')) return;

    try {
      const response = await fetch(`/api/collections/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Erro ao excluir coleção');

      toast.success('Coleção excluída com sucesso');
      fetchCollections();
    } catch (error) {
      toast.error('Erro ao excluir coleção');
      console.error(error);
    }
  };

  const handleCopyAccessId = async (accessId: string) => {
    try {
      await navigator.clipboard.writeText(accessId);
      toast.success('ID de acesso copiado para a área de transferência!');
    } catch (error) {
      toast.error('Erro ao copiar ID de acesso');
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Minhas Coleções</h1>
        <Button
          onClick={() => router.push('/transcricoes')}
          variant="outline"
        >
          Voltar às Transcrições
        </Button>
      </div>

      {collections.length === 0 ? (
        <div className="rounded-lg bg-gray-800 p-8 text-center border border-gray-700">
          <p className="text-gray-300">Nenhuma coleção encontrada</p>
          <p className="text-gray-400 mt-2">
            Crie sua primeira coleção adicionando transcrições do histórico
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className="rounded-lg border border-gray-700 bg-gray-800 p-6 shadow-sm"
            >
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-white mb-2">
                  {collection.name}
                </h3>
                {collection.description && (
                  <p className="text-gray-300 text-sm mb-3">
                    {collection.description}
                  </p>
                )}
                <p className="text-gray-400 text-xs">
                  Criada em: {new Date(collection.createdAt).toLocaleDateString()}
                </p>
                <p className="text-gray-400 text-xs">
                  {collection.items.length} transcrições
                </p>
              </div>

              <div className="mb-4">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-sm text-gray-300">ID de Acesso:</span>
                  <code className="text-xs bg-gray-700 px-2 py-1 rounded text-green-300">
                    {collection.accessId.substring(0, 8)}...
                  </code>
                </div>
                <Button
                  onClick={() => handleCopyAccessId(collection.accessId)}
                  size="sm"
                  variant="outline"
                  className="w-full"
                >
                  Copiar ID Completo
                </Button>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={() => router.push(`/collections/${collection.id}`)}
                  className="w-full"
                >
                  Visualizar Coleção
                </Button>
                <Button
                  onClick={() => handleDeleteCollection(collection.id)}
                  variant="outline"
                  size="sm"
                  className="w-full text-red-400 hover:text-red-300"
                >
                  Excluir Coleção
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 