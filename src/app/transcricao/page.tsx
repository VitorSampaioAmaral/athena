'use client';

import ImageUploader from '@/components/ImageUploader';

export default function TranscricaoPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-center text-4xl font-bold text-foreground">
        Transcrição de Imagens
      </h1>
      <p className="mb-8 text-center text-lg text-muted-foreground">
        Faça upload de uma imagem para extrair o texto e analisar seu conteúdo
      </p>
      <ImageUploader />
    </main>
  );
} 