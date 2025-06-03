'use client';

import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';

export default function Home() {
  const [imageUrl, setImageUrl] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const reader = new FileReader();

      reader.onload = async (e) => {
        if (e.target?.result) {
          const base64String = e.target.result.toString().split(',')[1];
          setImageUrl(URL.createObjectURL(file));
          await analyzeImage(base64String);
        }
      };

      reader.readAsDataURL(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png']
    },
    maxSize: 5242880 // 5MB
  });

  const analyzeImage = async (imageBase64: string) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageBase64 }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao analisar a imagem');
      }

      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar a imagem');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-center mb-8">
          Análise de Imagens com IA
        </h1>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p>Solte a imagem aqui...</p>
          ) : (
            <p>Arraste uma imagem aqui, ou clique para selecionar</p>
          )}
        </div>

        {imageUrl && (
          <div className="relative w-full h-[400px] max-w-3xl mx-auto">
            <Image
              src={imageUrl}
              alt="Imagem carregada"
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority
              className="object-contain rounded-lg"
            />
          </div>
        )}

        {isLoading && (
          <div className="text-center">
            <p>Analisando imagem...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {analysis && (
          <div className="p-6 bg-white rounded-lg shadow">
            <h2 className="text-2xl font-semibold mb-4">Análise da Imagem</h2>
            <div className="whitespace-pre-wrap">{analysis}</div>
          </div>
        )}
      </div>
    </main>
  );
}
