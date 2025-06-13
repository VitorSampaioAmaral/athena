import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  isLoading: boolean;
  progress: number;
}

export function ImageUpload({ onImageSelect, isLoading, progress }: ImageUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onImageSelect(acceptedFiles[0]);
    }
  }, [onImageSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff']
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: false,
    disabled: isLoading
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          p-8 border-2 border-dashed rounded-xl
          ${isDragActive 
            ? 'border-primary-500 bg-primary-500/10' 
            : isLoading
            ? 'border-secondary-700 bg-secondary-800/50 cursor-not-allowed'
            : 'border-secondary-700 bg-secondary-800/50 cursor-pointer hover:border-primary-500 hover:bg-primary-500/5'
          }
          transition-all duration-200 ease-in-out
        `}
      >
        <input {...getInputProps()} />
        
        <div className="text-center">
          <div className="w-16 h-16 mx-auto text-secondary-400">
            {isDragActive ? (
              <svg className="w-full h-full animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            ) : isLoading ? (
              <svg className="w-full h-full animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          
          <div>
            <p className="text-lg font-medium text-secondary-200">
              {isDragActive ? (
                'Solte a imagem aqui...'
              ) : isLoading ? (
                'Processando imagem...'
              ) : (
                <>
                  Arraste uma imagem ou <span className="text-primary-400 underline">clique para selecionar</span>
                </>
              )}
            </p>
            <p className="text-sm text-secondary-400 mt-2">
              Formatos aceitos: JPG, JPEG, PNG, GIF, BMP, TIFF (máx. 5MB)
            </p>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-secondary-400">
              {progress < 100 ? 'Carregando imagem...' : 'Analisando imagem...'}
            </span>
            <span className="text-primary-400 font-medium">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-secondary-700 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-primary-500 to-primary-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
} 