'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ImageAnalysis } from '@/components/ImageAnalysis';
import styles from './ImageUploader.module.css';

export default function ImageUploader() {
  const [imageData, setImageData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
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
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
    disabled: isLoading || isValidating
  });

  const handleClear = () => {
    setImageData(null);
    setError(null);
    setValidationMessage(null);
  };

  return (
    <div className={styles.uploaderContainer}>
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
        <input {...getInputProps()} />
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
          disabled={!imageData || isLoading || isValidating}
          className={`${styles.actionButton} ${styles.secondaryButton}`}
        >
          Limpar
        </button>
      </div>

      {imageData && <ImageAnalysis imageData={imageData} />}
      
      {imageData && (
        <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Resultado da Análise:</h3>
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <p>A imagem foi carregada com sucesso e está sendo analisada.</p>
            <p className="mt-2">Aguarde enquanto processamos os detalhes da imagem...</p>
          </div>
        </div>
      )}
    </div>
  );
} 