'use client';

import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <nav className="mb-8 border-b border-gray-800 bg-gray-900 py-4">
      <div className="container mx-auto flex items-center justify-between px-4">
        <Link href="/transcricao" className="text-xl font-bold text-white">
          Athena
        </Link>
        <div className="flex items-center gap-4">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-4">
              <span className="text-gray-300">Olá, {user.name || user.email}</span>
              <button
                onClick={logout}
                className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400 transition hover:bg-red-500/20"
              >
                Sair
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg bg-primary-500 px-4 py-2 text-white transition-colors hover:bg-primary-600"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg border border-primary-500 px-4 py-2 text-primary-500 transition-colors hover:bg-primary-500 hover:text-white"
              >
                Cadastro
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
} 