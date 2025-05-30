'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { PhotoIcon } from '@heroicons/react/24/outline';

export default function Home() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    try {
      setLoading(true);
      setError(null);
      
      // Converter a imagem para base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Image = e.target?.result as string;
        setImageUrl(base64Image);

        try {
          const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageBase64: base64Image.split(',')[1],
            }),
          });

          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.error || 'Erro ao analisar a imagem');
          }

          setAnalysis(data.analysis);
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Erro ao processar a imagem');
        } finally {
          setLoading(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      setError('Erro ao processar o arquivo');
      setLoading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    },
    maxFiles: 1,
  });

  return (
    <main className="container">
      <h1 className="title">Transcritor de Imagens</h1>
      
      <div className="grid">
        <div>
          <div
            {...getRootProps()}
            className={`dropzone ${isDragActive ? 'active' : ''}`}
          >
            <input {...getInputProps()} />
            <PhotoIcon className="icon" />
            <p>
              {isDragActive
                ? 'Solte a imagem aqui...'
                : 'Arraste uma imagem ou clique para selecionar'}
            </p>
          </div>

          {imageUrl && (
            <div className="image-container">
              <img
                src={imageUrl}
                alt="Imagem carregada"
              />
            </div>
          )}
        </div>

        <div className="analysis-panel">
          <h2 className="analysis-title">Análise da Imagem</h2>
          
          {loading && (
            <div className="loading">
              <div className="spinner"></div>
              <span>Analisando imagem...</span>
            </div>
          )}

          {error && (
            <div className="error">
              {error}
            </div>
          )}

          {analysis && !loading && (
            <div className="analysis-content">
              {analysis}
            </div>
          )}

          {!analysis && !loading && !error && (
            <p className="text-center">
              Carregue uma imagem para ver a análise
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
