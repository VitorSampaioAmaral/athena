'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function HomePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  const handleStartTranscription = () => {
    setIsLoading(true);
    router.push('/transcricao');
  };

  const handleLogin = () => {
    setIsLoading(true);
    router.push('/login');
  };

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <h1 className="mb-8 text-4xl font-bold text-foreground">Bem-vindo ao Athena</h1>
        <p className="mb-8 text-center text-lg text-muted-foreground">
          Faça login para começar a transcrever suas imagens
        </p>
        <button
          onClick={handleLogin}
          className="rounded-md bg-gradient-to-r from-cyan-500 to-emerald-600 px-4 py-2 text-white hover:from-cyan-600 hover:to-emerald-700 transition-all duration-200"
        >
          Fazer Login
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <h1 className="mb-8 text-4xl font-bold text-foreground">Bem-vindo ao Athena</h1>
      <p className="mb-8 text-center text-lg text-muted-foreground">
        Comece a transcrever suas imagens agora mesmo
      </p>
      <button
        onClick={handleStartTranscription}
        disabled={isLoading}
        className="rounded-md bg-gradient-to-r from-cyan-500 to-emerald-600 px-4 py-2 text-white hover:from-cyan-600 hover:to-emerald-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Carregando...' : 'Começar Transcrição'}
      </button>
    </div>
  );
}
