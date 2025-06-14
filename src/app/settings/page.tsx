'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleToggleNotifications = async () => {
    try {
      const response = await fetch('/api/settings/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: !isNotificationsEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao atualizar configurações');
      }

      setIsNotificationsEnabled(!isNotificationsEnabled);
      toast.success(
        isNotificationsEnabled
          ? 'Notificações desativadas'
          : 'Notificações ativadas'
      );
    } catch (error) {
      toast.error('Erro ao atualizar configurações');
      console.error('Erro:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.')) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch('/api/user/delete', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Falha ao excluir conta');
      }

      toast.success('Conta excluída com sucesso');
      router.push('/login');
    } catch (error) {
      toast.error('Erro ao excluir conta');
      console.error('Erro:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <h1 className="mb-8 text-4xl font-bold">Acesso Restrito</h1>
        <p className="mb-8 text-center text-lg text-gray-600">
          Você precisa estar logado para acessar esta página
        </p>
        <button
          onClick={() => router.push('/login')}
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-500"
        >
          Fazer Login
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-center text-4xl font-bold">Configurações</h1>

      <div className="mx-auto max-w-2xl space-y-6 rounded-lg bg-white p-6 shadow-lg">
        <div>
          <h2 className="mb-4 text-xl font-semibold">Perfil</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <p className="mt-1 text-gray-900">{session.user.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nome
              </label>
              <p className="mt-1 text-gray-900">{session.user.name || 'Não definido'}</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-xl font-semibold">Preferências</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Notificações por email
                </label>
                <p className="text-sm text-gray-500">
                  Receba notificações sobre suas transcrições
                </p>
              </div>
              <button
                className={`rounded-md px-4 py-2 text-white ${
                  isNotificationsEnabled
                    ? 'bg-green-600 hover:bg-green-500'
                    : 'bg-gray-600 hover:bg-gray-500'
                }`}
                onClick={handleToggleNotifications}
              >
                {isNotificationsEnabled ? 'Ativado' : 'Desativado'}
              </button>
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-xl font-semibold">Conta</h2>
          <div className="space-y-4">
            <button
              className="w-full rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-500 disabled:opacity-50"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? 'Excluindo...' : 'Excluir Conta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 