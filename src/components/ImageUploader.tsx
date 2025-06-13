'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ImageAnalysis } from '@/components/ImageAnalysis';

export default function ImageUploader() {
  const [imageData, setImageData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    try {
      const file = acceptedFiles[0];
      if (!file) return;

      // Verifica o tamanho do arquivo (máximo 10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('O arquivo é muito grande. O tamanho máximo é 10MB.');
      }

      // Verifica o tipo do arquivo
      if (!file.type.startsWith('image/')) {
        throw new Error('Por favor, selecione apenas arquivos de imagem.');
      }

      const reader = new FileReader();
      reader.onload = () => {
        setImageData(reader.result as string);
        setError(null);
      };
      reader.onerror = () => {
        setError('Erro ao ler o arquivo. Por favor, tente novamente.');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar a imagem');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    maxFiles: 1,
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div
        {...getRootProps()}
        className={`relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors
          ${isDragActive
            ? 'border-primary-500 bg-primary-500/10'
            : 'border-gray-600 hover:border-primary-500 hover:bg-primary-500/10'
          }`}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="text-center">
            <p className="text-lg text-gray-300">
              {isDragActive
                ? 'Solte a imagem aqui...'
                : 'Arraste e solte uma imagem aqui, ou clique para selecionar'}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              PNG, JPG, GIF ou WEBP até 10MB
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      {imageData && <ImageAnalysis imageData={imageData} />}
    </div>
  );
} 