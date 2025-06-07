'use client';

import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [imageUrl, setImageUrl] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;

  const onDrop = async (acceptedFiles: File[]) => {
    if (!isAuthenticated) {
      setError('Faça login para analisar imagens');
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      
      // Validar o tipo do arquivo
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff'];
      if (!validTypes.includes(file.type)) {
        setError('Tipo de arquivo não suportado. Use JPG, PNG, GIF, BMP ou TIFF.');
        return;
      }

      const reader = new FileReader();

      reader.onload = async (e) => {
        if (e.target?.result) {
          try {
            // Extrair o base64 da string completa (remover o prefixo data:image/...)
            const base64String = e.target.result.toString().split(',')[1];
            setImageUrl(URL.createObjectURL(file));
            setUploadProgress(0);
            await analyzeImage(base64String);
          } catch (error) {
            console.error('Erro ao processar arquivo:', error);
            setError('Erro ao processar o arquivo. Tente novamente.');
          }
        }
      };

      reader.onerror = () => {
        setError('Erro ao ler o arquivo. Tente novamente.');
      };

      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          setUploadProgress(progress);
        }
      };

      reader.readAsDataURL(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.bmp', '.tiff']
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
        if (response.status === 500 && data.error?.includes('Timeout') && retryCount < maxRetries) {
          setRetryCount(prev => prev + 1);
          setError(`Tentativa ${retryCount + 1} de ${maxRetries + 1}: Serviço sobrecarregado, tentando novamente...`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Espera 2 segundos
          return analyzeImage(imageBase64);
        }

        throw new Error(data.error || 'Erro ao analisar a imagem');
      }

      setAnalysis(data.analysis);
      setRetryCount(0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar a imagem';
      
      let userMessage = errorMessage;
      if (errorMessage.includes('Timeout')) {
        userMessage = 'O serviço está temporariamente sobrecarregado. Por favor, tente novamente em alguns minutos.';
      } else if (errorMessage.includes('network')) {
        userMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
      }
      
      setError(userMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
      <Navbar />

      <div className="max-w-4xl mx-auto space-y-6 pt-16">
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-4xl font-extrabold tracking-tight lg:text-5xl">
              Análise de Imagens com IA
            </CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              {isAuthenticated 
                ? 'Arraste ou faça upload de uma imagem para análise detalhada'
                : 'Faça login ou crie uma conta para começar a analisar imagens'}
            </CardDescription>
            <CardDescription className="text-sm text-muted-foreground max-w-lg mx-auto">
              Nossa tecnologia OCR (Reconhecimento Óptico de Caracteres) permite extrair texto de imagens com alta precisão, 
              identificando automaticamente o idioma e preservando a formatação original.
            </CardDescription>
          </CardHeader>

          {!isAuthenticated && (
            <CardFooter className="flex flex-col items-center gap-4 pt-4">
              <div className="flex gap-4">
                <Button variant="outline" size="lg" className="font-medium" asChild>
                  <Link href="/login">Fazer Login</Link>
                </Button>
                <Button size="lg" className="font-medium" asChild>
                  <Link href="/register">Criar Conta</Link>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                É necessário fazer login para utilizar o serviço de análise de imagens
              </p>
            </CardFooter>
          )}
        </Card>

        <Card 
          {...getRootProps()}
          className={`border-2 border-dashed relative cursor-pointer transition-all duration-300
            ${isDragActive 
              ? 'border-primary bg-primary/5 shadow-md' 
              : 'border-muted hover:border-primary/50 hover:bg-muted/30'}
            ${!isAuthenticated ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <input {...getInputProps()} />
          {!isAuthenticated && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m0 0v2m0-2H8m2 0h2M3 12l2-2m0 0l7-7 7 7m-7-7v14" />
                </svg>
                Faça login para ativar o upload
              </div>
            </div>
          )}
          <CardContent className="py-8">
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 mx-auto">
                {isDragActive ? (
                  <svg className="w-full h-full text-primary animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                ) : (
                  <svg className="w-full h-full text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-lg font-medium">
                  {isDragActive ? (
                    'Solte a imagem aqui...'
                  ) : (
                    <>
                      Arraste uma imagem ou <span className="text-primary underline cursor-pointer">clique para selecionar</span>
                    </>
                  )}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Formatos aceitos: JPG, JPEG, PNG, GIF, BMP, TIFF (máx. 5MB)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {uploadProgress > 0 && uploadProgress < 100 && (
          <Card>
            <CardContent className="py-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Carregando imagem...</span>
                  <span className="text-primary font-medium">{Math.round(uploadProgress)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-primary h-full rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {imageUrl && (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="relative w-full h-[250px] sm:h-[300px] md:h-[400px]">
                <Image
                  src={imageUrl}
                  alt="Imagem carregada"
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  priority
                  className="object-contain"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <Card>
            <CardContent className="py-6">
              <div className="space-y-6">
                <div className="flex items-center justify-center gap-3">
                  <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                  <p className="text-lg font-medium text-primary">Analisando imagem com OCR...</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium text-sm mb-2">Dicas para melhor resultado:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                    <li>Certifique-se que o texto está nítido e legível</li>
                    <li>Evite imagens com texto em ângulos muito inclinados</li>
                    <li>Prefira imagens com bom contraste entre texto e fundo</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Alert variant="destructive" className="animate-fade-in">
            <AlertTitle className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Erro
            </AlertTitle>
            <AlertDescription>
              <p className="mt-1">{error}</p>
              {error.includes('sobrecarregado') && (
                <p className="text-xs mt-2 text-destructive-foreground/80">
                  Dica: O serviço está com alta demanda. Tente novamente em alguns minutos.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {analysis && (
          <Card className="animate-fade-in">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-2xl">Análise da Imagem</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setImageUrl('');
                  setAnalysis('');
                  setError('');
                }}
                className="hover:bg-muted"
                title="Analisar nova imagem"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="prose prose-neutral">
                <div className="whitespace-pre-wrap">{analysis}</div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
