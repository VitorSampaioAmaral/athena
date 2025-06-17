'use client';

import ImageUploader from '@/components/ImageUploader';
import CreditStatus from '@/components/CreditStatus';

export default function TranscricaoPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-center text-4xl font-bold text-white">
        Transcrição de Imagens
      </h1>
      <p className="mb-8 text-center text-lg text-white">
        Faça upload de uma imagem para extrair o texto e analisar seu conteúdo
      </p>
      
      <CreditStatus />
      
      <ImageUploader />
    </main>
  );
} 