'use client';

import ImageUploader from '@/components/ImageUploader';

export default function TranscricaoPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-center text-4xl font-bold text-white">
        Análise Acessível de Imagens
      </h1>
      <ImageUploader />
    </div>
  );
} 
