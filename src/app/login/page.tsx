'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    console.log('Iniciando processo de login...');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      console.log('Resultado do signIn:', result);

      if (result?.error) {
        setError(result.error);
      } else if (result?.ok) {
        console.log('Login bem-sucedido, redirecionando para /transcribe...');
        window.location.href = '/transcribe';
      } else {
        setError('Login falhou, tente novamente.');
      }
    } catch (error) {
      console.log('Erro capturado no catch:', error);
      setError('Ocorreu um erro ao fazer login');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-gray-800 p-6 shadow-lg border border-gray-700">
        <div>
          <h2 className="text-center text-3xl font-bold text-white">
            Entrar
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-900/50 p-4 text-sm text-red-300">
              {error}
            </div>
          )}
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="relative block w-full rounded-md border-0 py-1.5 text-white bg-gray-700 ring-1 ring-inset ring-gray-600 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="relative block w-full rounded-md border-0 py-1.5 text-white bg-gray-700 ring-1 ring-inset ring-gray-600 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Entrar
            </button>
          </div>

          <div className="text-center text-sm">
            <Link
              href="/register"
              className="font-medium text-blue-400 hover:text-blue-300"
            >
              Não tem uma conta? Registre-se
            </Link>
          </div>
          
          {/* Botão de teste para verificar se o router funciona */}
          <div className="text-center text-sm">
            <button
              type="button"
              onClick={() => {
                console.log('Testando router...');
                router.push('/transcribe');
              }}
              className="font-medium text-green-400 hover:text-green-300"
            >
              Teste Router (ir para /transcribe)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 