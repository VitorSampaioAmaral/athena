'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ImageAnalysis } from '@/components/ImageAnalysis';
import styles from './ImageUploader.module.css';

type TabType = 'upload' | 'url';

interface AnalysisResponse {
  analysis: string;
  processingTime: string;
  status: 'success' | 'partial' | 'error';
  error?: string;
}

export default function ImageUploader() {
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);

  const validateFile = (file: File): boolean => {
    // Verifica o tamanho do arquivo (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setValidationMessage('O arquivo é muito grande. O tamanho máximo é 10MB.');
      return false;
    }

    // Verifica o tipo do arquivo
    if (!file.type.startsWith('image/')) {
      setValidationMessage('Por favor, selecione apenas arquivos de imagem.');
      return false;
    }

    // Verifica a extensão do arquivo
    const validExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.webp'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validExtensions.includes(fileExtension)) {
      setValidationMessage('Formato de arquivo não suportado. Use: PNG, JPG, GIF ou WEBP.');
      return false;
    }

    setValidationMessage('Arquivo válido!');
    return true;
  };

  const validateUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      const validProtocols = ['http:', 'https:'];
      if (!validProtocols.includes(urlObj.protocol)) {
        setValidationMessage('URL deve usar HTTP ou HTTPS.');
        return false;
      }

      const validExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.webp'];
      const pathname = urlObj.pathname.toLowerCase();
      const hasValidExtension = validExtensions.some(ext => pathname.endsWith(ext));
      
      if (!hasValidExtension) {
        setValidationMessage('URL deve apontar para uma imagem (PNG, JPG, GIF ou WEBP).');
        return false;
      }

      setValidationMessage('URL válida!');
      return true;
    } catch {
      setValidationMessage('Por favor, insira uma URL válida.');
      return false;
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      setIsValidating(true);
      setError(null);
      setValidationMessage(null);

      const file = acceptedFiles[0];
      if (!file) {
        setValidationMessage('Nenhum arquivo selecionado.');
        return;
      }

      if (!validateFile(file)) {
        return;
      }

      setIsLoading(true);
      const reader = new FileReader();
      
      reader.onload = () => {
        setImageData(reader.result as string);
        setValidationMessage('Arquivo carregado com sucesso!');
      };
      
      reader.onerror = () => {
        setError('Erro ao ler o arquivo. Por favor, tente novamente.');
        setValidationMessage(null);
      };
      
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar a imagem');
      setValidationMessage(null);
    } finally {
      setIsLoading(false);
      setIsValidating(false);
      setIsAnalyzing(false);
      setAnalysisResult(null);
    }
  }, [isAnalyzing]);

  const handleUrlSubmit = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      setIsValidating(true);
      setError(null);
      setValidationMessage(null);

      if (!imageUrl.trim()) {
        setValidationMessage('Por favor, insira uma URL.');
        return;
      }

      if (!validateUrl(imageUrl)) {
        return;
      }

      setIsLoading(true);
      setImageData(imageUrl);
      setValidationMessage('URL carregada com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar a URL');
      setValidationMessage(null);
    } finally {
      setIsLoading(false);
      setIsValidating(false);
      setIsAnalyzing(false);
      setAnalysisResult(null);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
    disabled: isLoading || isValidating || isAnalyzing
  });

  const handleClear = () => {
    setImageData(null);
    setImageUrl('');
    setError(null);
    setValidationMessage(null);
    setIsAnalyzing(false);
    setAnalysisResult(null);
  };

  // Função chamada pelo ImageAnalysis ao finalizar
  const handleAnalysisDone = (result?: AnalysisResponse) => {
    setIsAnalyzing(false);
    if (result) setAnalysisResult(result);
    setImageData(null); // Limpa para não reprocessar
  };

  return (
    <div className={styles.uploaderContainer}>
      {/* Abas */}
      <div className="flex space-x-1 mb-6 bg-gray-800 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('upload')}
          disabled={isAnalyzing}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'upload'
              ? 'bg-gray-700 text-white shadow-sm'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          Upload de Arquivo
        </button>
        <button
          onClick={() => setActiveTab('url')}
          disabled={isAnalyzing}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'url'
              ? 'bg-gray-700 text-white shadow-sm'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          URL da Imagem
        </button>
      </div>

      {/* Conteúdo da aba Upload */}
      {activeTab === 'upload' && (
      <div
        {...getRootProps()}
        className={`${styles.dropzone} ${
          isLoading || isValidating
            ? styles.dropzoneDisabled
            : isDragActive
            ? styles.dropzoneActive
            : styles.dropzoneInactive
        }`}
      >
        <input {...getInputProps()} disabled={isLoading || isValidating || isAnalyzing} />
        <div className="space-y-4">
          <svg
            className={`${styles.uploadIcon} ${
              isLoading || isValidating
                ? styles.uploadIconDisabled
                : isDragActive
                ? styles.uploadIconActive
                : ''
            }`}
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
            <p className={`${styles.uploadText} ${
              isLoading || isValidating
                ? styles.uploadTextDisabled
                : isDragActive
                ? styles.uploadTextActive
                : ''
            }`}>
              {isLoading
                ? 'Processando imagem...'
                : isValidating
                ? 'Validando arquivo...'
                : isDragActive
                ? 'Solte a imagem aqui...'
                : 'Arraste e solte uma imagem aqui, ou clique para selecionar'}
            </p>
            <p className={`${styles.uploadSubtext} ${
              isLoading || isValidating ? styles.uploadSubtextDisabled : ''
            }`}>
              PNG, JPG, GIF ou WEBP até 10MB
            </p>
          </div>
        </div>
      </div>
      )}

      {/* Conteúdo da aba URL */}
      {activeTab === 'url' && (
        <div className="space-y-4">
          <div className="flex space-x-2">
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://exemplo.com/imagem.jpg"
              className="flex-1 px-4 py-2 border border-gray-600 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading || isValidating || isAnalyzing}
            />
            <button
              onClick={handleUrlSubmit}
              disabled={!imageUrl.trim() || isLoading || isValidating || isAnalyzing}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Carregando...' : 'Carregar'}
            </button>
          </div>
          <p className="text-sm text-white">
            Insira a URL de uma imagem
          </p>
        </div>
      )}

      {validationMessage && (
        <div className={`${styles.validationMessage} ${
          validationMessage.includes('sucesso')
            ? styles.validationMessageSuccess
            : styles.validationMessageError
        }`}>
          {validationMessage}
        </div>
      )}

      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      <div className={styles.buttonContainer}>
        <button
          onClick={handleClear}
          disabled={!imageData || isLoading || isValidating || isAnalyzing}
          className={`${styles.actionButton} ${styles.secondaryButton}`}
        >
          Limpar
        </button>
      </div>

      {imageData && <ImageAnalysis imageData={imageData} onDone={handleAnalysisDone} />}
      
      {analysisResult && (
        <div className="mt-4 p-4 bg-gray-800 rounded-lg">
          <h3 className="text-lg font-semibold mb-2 text-white">Resultado da Análise:</h3>
          <div className="text-sm text-white whitespace-pre-line">
            {/* Separar as seções usando regex */}
            {(() => {
              let text = typeof analysisResult === 'string' ? analysisResult : analysisResult?.analysis;
              if (typeof text !== 'string') text = '';
              // Remove # e - do início das linhas
              text = text.replace(/^[#\-]+\s?/gm, '');
              const textMatch = text.match(/=+\s*TEXTO EXTRA[IÍ]DO\s*=+\n([\s\S]*?)(?=\n=+\s*DESCRI[CÇ][AÃ]O VISUAL\s*=+|$)/i);
              const visualMatch = text.match(/=+\s*DESCRI[CÇ][AÃ]O VISUAL\s*=+\n([\s\S]*?)(?=\n=+\s*CONTEXTO\s*=+|$)/i);
              const contextMatch = text.match(/=+\s*CONTEXTO\s*=+\n([\s\S]*?)$/i);
              return (
                <>
                  {textMatch && (
                    <div className="mb-4">
                      <div className="font-bold text-blue-400 mb-1">📝 Texto Extraído</div>
                      <div className="bg-blue-900/20 rounded p-2 ml-4">{textMatch[1].trim()}</div>
                    </div>
                  )}
                  {visualMatch && (
                    <div className="mb-4">
                      <div className="font-bold text-green-400 mb-1">👁️ Descrição Visual</div>
                      <div className="bg-green-900/20 rounded p-2 ml-4">{visualMatch[1].trim()}</div>
                    </div>
                  )}
                  {contextMatch && (
                    <div className="mb-4">
                      <div className="font-bold text-purple-400 mb-1">🎯 Contexto</div>
                      <div className="bg-purple-900/20 rounded p-2 ml-4">{contextMatch[1].trim()}</div>
                    </div>
                  )}
                  {!textMatch && !visualMatch && !contextMatch && (
                    <div>{text}</div>
                  )}
                </>
              );
            })()}
          </div>
          {analysisResult.processingTime && (
            <div className="text-xs text-gray-400 mt-2">Tempo de processamento: {analysisResult.processingTime}</div>
          )}
          {analysisResult.error && (
            <div className="text-xs text-red-400 mt-2">Erro: {analysisResult.error}</div>
          )}
        </div>
      )}
    </div>
  );
} 
