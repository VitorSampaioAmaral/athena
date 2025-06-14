'use client';

import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

export function useAuth() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const logout = async () => {
    try {
      await signOut({ redirect: false });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return {
    user: session?.user || null,
    loading: status === 'loading',
    logout,
    isAuthenticated: status === 'authenticated'
  };
} 