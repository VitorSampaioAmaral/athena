'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDropzone } from 'react-dropzone';

interface TranscriptionResult {
  transcription: string;
  id: string;
}

export default function TranscribePage() {
  const { status } = useSession();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<TranscriptionResult | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione apenas arquivos de imagem');
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      console.log('[DEBUG] Resposta da transcrição:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DEBUG] Erro na transcrição:', errorText);
        throw new Error('Erro na transcrição');
      }

      const data = await response.json();
      console.log('[DEBUG] Dados da transcrição recebidos:', data);
      setResult(data);
      toast.success('Transcrição concluída com sucesso!');
    } catch (error) {
      console.error('[DEBUG] Erro completo na transcrição:', error);
      console.error('Erro na transcrição:', error);
      toast.error('Erro ao processar a imagem');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.bmp']
    },
    multiple: false
  });

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"></div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-4">Transcrever Imagem</h1>
        <p className="text-gray-300">
          Faça upload de uma imagem.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Upload de arquivo */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Upload de Arquivo</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
            >
              <input {...getInputProps()} />
              <div className="space-y-4">
                <div className="text-6xl">📁</div>
                <p className="text-gray-300">
                  {isDragActive
                    ? 'Solte o arquivo aqui...'
                    : 'Arraste e solte uma imagem aqui, ou clique para selecionar'}
                </p>
                <p className="text-sm text-gray-400">
                  Suporta: JPG, PNG, GIF, BMP
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resultado */}
      {isProcessing && (
        <Card className="mt-8 bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-2">
              <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"></div>
              <span className="text-white">Processando transcrição...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="mt-8 bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Resultado da Transcrição</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={result.transcription}
              readOnly
              className="bg-gray-700 border-gray-600 text-white min-h-[200px]"
            />
            <div className="mt-4 flex space-x-2">
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(result.transcription);
                  toast.success('Texto copiado para a área de transferência!');
                }}
                variant="outline"
              >
                Copiar Texto
              </Button>
              <Button
                onClick={() => router.push('/transcricoes')}
                variant="outline"
              >
                Ver Histórico
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 
