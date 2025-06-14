'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function Navigation() {
  const { data: session } = useSession();
  const router = useRouter();

  const handleLogin = () => {
    router.push('/login');
  };

  return (
    <nav className="bg-card/50 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-foreground">
              Athena
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {session ? (
              <>
                <Link
                  href="/transcricao"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Transcrever
                </Link>
                <Link
                  href="/transcricoes"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Histórico
                </Link>
                <Link
                  href="/settings"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Configurações
                </Link>
                <button
                  onClick={() => signOut()}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleLogin}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Login
                </button>
                <Link
                  href="/register"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cadastro
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 