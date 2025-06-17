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
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-white">
              Athena
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {session ? (
              <>
                <Link
                  href="/transcricao"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Transcrever
                </Link>
                <Link
                  href="/transcricoes"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Histórico
                </Link>
                <Link
                  href="/collections"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Coleções
                </Link>
                <Link
                  href="/settings"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Configurações
                </Link>
                <button
                  onClick={() => signOut()}
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleLogin}
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Login
                </button>
                <Link
                  href="/register"
                  className="text-gray-300 hover:text-white transition-colors"
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