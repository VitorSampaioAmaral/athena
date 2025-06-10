'use client';

import ImageUploader from '@/components/ImageUploader';
import Navbar from '@/components/Navbar';

export default function TranscricaoPage() {
  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="mb-8 text-center text-4xl font-bold">
          Transcrição de Imagens
        </h1>
        <p className="mb-8 text-center text-lg text-gray-300">
          Faça upload de uma imagem para extrair o texto e analisar seu conteúdo
        </p>
        <ImageUploader />
      </main>
    </>
  );
} 