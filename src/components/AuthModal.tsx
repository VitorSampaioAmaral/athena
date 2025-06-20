import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`/api/auth/${isLogin ? 'login' : 'register'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name: isLogin ? undefined : name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro na autenticação');
      }

      // Fechar modal e redirecionar
      onClose();
      router.refresh();
    } catch (error) {
      console.error('Erro na autenticação:', error);
      toast.error(error instanceof Error ? error.message : 'Erro na autenticação');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-secondary-900 rounded-xl shadow-xl p-6 space-y-6">
        {/* Cabeçalho */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white">
            {isLogin ? 'Fazer Login' : 'Criar Conta'}
          </h2>
          <p className="text-secondary-400 mt-2">
            {isLogin 
              ? 'Entre para salvar suas análises'
              : 'Crie uma conta para começar a salvar suas análises'
            }
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-secondary-300">
                Nome
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md bg-secondary-800 border border-secondary-700 
                         text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-secondary-300">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md bg-secondary-800 border border-secondary-700 
                       text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-secondary-300">
              Senha
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md bg-secondary-800 border border-secondary-700 
                       text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 rounded-md bg-primary-600 text-white font-medium
                     hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processando...
              </span>
            ) : (
              isLogin ? 'Entrar' : 'Criar Conta'
            )}
          </button>
        </form>

        {/* Alternar entre login e registro */}
        <div className="text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary-400 hover:text-primary-300 text-sm font-medium focus:outline-none"
          >
            {isLogin 
              ? 'Não tem uma conta? Criar conta'
              : 'Já tem uma conta? Fazer login'
            }
          </button>
        </div>

        {/* Botão de fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-secondary-400 hover:text-secondary-300 focus:outline-none"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
} 
